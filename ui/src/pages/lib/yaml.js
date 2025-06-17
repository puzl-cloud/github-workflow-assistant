import { parse, stringify } from "yaml";

/**
 * Replaces all matching labels in a GitHub Actions `runs-on` value with a single replacement,
 * placing the replacement in the position of the first matched label and preserving order.
 *
 * @param {string | string[]} currentValue - The original `runs-on` value (string or array of strings).
 * @param {string[]} labelsToReplace - List of labels to replace.
 * @param {string} replacementLabel - The label that will replace any matched labels.
 * @returns {string[]} The updated `runs-on` value as an array.
 */
export function replaceRunsOnLabels(
  currentValue,
  labelsToReplace,
  replacementLabel,
) {
  const toReplace = new Set(labelsToReplace);

  if (typeof currentValue === "string") {
    return toReplace.has(currentValue) ? [replacementLabel] : [currentValue];
  }

  if (Array.isArray(currentValue)) {
    let result = [];
    let replaced = false;

    for (let i = 0; i < currentValue.length; i++) {
      const label = currentValue[i];
      if (toReplace.has(label)) {
        if (!replaced) {
          result.push(replacementLabel);
          replaced = true;
        }
      } else {
        result.push(label);
      }
    }

    return result;
  }

  return [];
}

import { parseDocument, isMap, isSeq } from "yaml";
import { decodeBase64 } from "@/lib/helpers.js";

/**
 * Replaces `runs-on` values in YAML text using AST and formatting,
 * only when any value matches `labelsToReplace`. Other formatting is preserved.
 * ToDo: function doesn't preserve comments within runs-on block.
 *
 * @param {string} yamlText - The original YAML text.
 * @param {string[] | Set<string>} labelsToReplace - Labels to look for and replace.
 * @param {string} replacementLabel - Label to insert instead.
 * @returns {string} - Updated YAML text with only matching `runs-on` values changed.
 */
export function replaceRunsOnInYaml(
  yamlText,
  labelsToReplace,
  replacementLabel,
) {
  const labelSet =
    labelsToReplace instanceof Set ? labelsToReplace : new Set(labelsToReplace);

  const doc = parseDocument(yamlText, {
    keepCstNodes: true,
    keepNodeTypes: true,
  });

  const replacements = [];

  function visit(node) {
    if (isMap(node)) {
      for (const pair of node.items) {
        const key = pair.key?.value;

        if (key === "runs-on") {
          const valNode = pair.value;
          if (!valNode?.range) continue;

          const currentValue = valNode.toJSON();
          const currentLabels = Array.isArray(currentValue)
            ? currentValue
            : [currentValue];
          const shouldReplace = currentLabels.some((label) =>
            labelSet.has(label),
          );

          if (!shouldReplace) continue;

          const replaced = replaceRunsOnLabels(
            currentValue,
            Array.from(labelSet),
            replacementLabel,
          );

          // Use the start of the *key* ("runs-on") line to detect indent
          // Step 1: detect base indent of the key line (runs-on:)
          const keyLines = yamlText.slice(0, pair.key.range[0]).split("\n");
          const keyLine = keyLines[keyLines.length - 1];
          const baseIndent = keyLine.match(/^\s*/)?.[0] ?? "";

          // Step 2: detect indent used in original array items
          let valueIndent = baseIndent + "  "; // fallback

          // Format entire runs-on: block as YAML, then re-indent
          const formatted = stringify({ "runs-on": replaced }).trimEnd();
          const formattedLines = formatted.split("\n");
          const properlyIndented =
            formattedLines
              .map((line, i) =>
                i === 0 ? baseIndent + line : valueIndent + line.trim(),
              )
              .join("\n") + "\n";

          // Step 1: collect lines up to and including value
          const allLines = yamlText.split("\n");
          const startOffset = pair.key.range[0];
          const startLineIdx =
            yamlText.slice(0, startOffset).split("\n").length - 1;

          let endLineIdx = startLineIdx;
          for (let i = startLineIdx + 1; i < allLines.length; i++) {
            const line = allLines[i];

            const isListItem = /^\s*-\s+/.test(line);
            const isEmpty = /^\s*$/.test(line);
            const isNextKey = /^\s*\w[\w-]*\s*:\s*/.test(line); // like `design:`

            if (isListItem || isEmpty) {
              endLineIdx = i;
            } else if (isNextKey) {
              break;
            } else {
              endLineIdx = i;
            }
          }

          // Step 2: compute character positions
          const startCharOffset = allLines
            .slice(0, startLineIdx)
            .reduce((acc, line) => acc + line.length + 1, 0);

          const endCharOffset = allLines
            .slice(0, endLineIdx + 1)
            .reduce((acc, line) => acc + line.length + 1, 0);

          // Step 3: insert the properlyIndented block with trailing newline
          replacements.push({
            start: startCharOffset,
            end: endCharOffset,
            newText: properlyIndented,
          });
        } else {
          visit(pair.value);
        }
      }
    } else if (isSeq(node)) {
      for (const item of node.items) {
        visit(item);
      }
    }
  }

  visit(doc.contents);

  if (!replacements.length) return yamlText;

  let result = yamlText;
  for (const { start, end, newText } of [...replacements].sort(
    (a, b) => b.start - a.start,
  )) {
    result = result.slice(0, start) + newText + result.slice(end);
  }

  return result;
}

export function transformYamlFiles(files, runsOnToReplace, replacementValue) {
  return files.map(({ originalPath, content, ...rest }) => {
    const decoded = decodeBase64(content);
    const updated = replaceRunsOnInYaml(
      decoded,
      runsOnToReplace,
      replacementValue,
    );

    const wasModified = decoded !== updated;

    return {
      path: originalPath,
      content: btoa(updated),
      wasModified,
    };
  });
}

export function getRunsOnValues(yamlText) {
  const result = new Set();

  try {
    const parsed = parse(yamlText);

    function traverse(node) {
      if (Array.isArray(node)) {
        node.forEach(traverse);
      } else if (node && typeof node === "object") {
        for (const key in node) {
          if (key === "runs-on") {
            const val = node[key];
            if (Array.isArray(val)) {
              val.forEach((v) => result.add(v));
            } else {
              result.add(val);
            }
          } else {
            traverse(node[key]);
          }
        }
      }
    }

    traverse(parsed);
  } catch (err) {
    console.error("Failed to parse YAML:", err);
  }

  return Array.from(result);
}
