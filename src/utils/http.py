import asyncio
import logging
from typing import Any, Dict, List, Optional, Callable, Union
from http import HTTPMethod

import aiohttp

from src.models import RESTAPIError, GraphQLError


async def rest_api_request(
    method: HTTPMethod,
    endpoint: str,
    headers: Dict[str, str],
    api_name: str,
    default_headers: Dict[str, str] = None,
    data: Optional[Dict[str, Union[str, int, bool]]] = None,
    retry_timeout: int = 5,
    max_attempts: int = 3,
    log_success: bool = False,
    accept_codes: List[int] | Callable = None,
    log_data: bool = False,
    log_response_body: bool = True,
    retry_codes: List[int] = None
) -> Dict | List:

    retry_codes = retry_codes or []
    headers |= default_headers or {}
    extra_log = {"API": api_name, "endpoint": endpoint, "method": method, "data": data if log_data else None}
    logging.debug(f"Requesting {api_name} API", extra=extra_log)
    try:
        async with aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=(retry_timeout+5)*max_attempts)) as session:
            attempt = 0
            while attempt < max_attempts:
                attempt += 1
                async with session.request(method, endpoint, headers=headers, json=data) as response:
                    if response.status == 204:
                        return {}

                    response_text = await response.text()
                    extra_log |= {
                        "attempt": attempt,
                        "status": response.status,
                        "response": response_text if log_response_body else None}
                    if response.status in retry_codes:
                        if attempt < max_attempts:
                            logging.warning("Retrying request due to response status", extra=extra_log)
                            await asyncio.sleep(retry_timeout)
                            continue
                        else:
                            raise RESTAPIError(response.status, "Max retry attempts reached", response_text)

                    if response.status >= 400:
                        if type(accept_codes) is list or accept_codes is None:
                            mute_error = response.status in (accept_codes or [])
                        else:
                            mute_error = accept_codes(response.status)

                        msg = f"{api_name} API request failed."
                        extra_log["error"] = response_text
                        if not mute_error:
                            logging.error(msg, extra=extra_log)
                            raise RESTAPIError(response.status, msg, response_text)

                        logging.info(f"{msg} Response text has been muted to avoid showing sensitive data "
                                     f"like tokens. To see such data, set log level to `DEBUG`.",
                                     extra={"status": response.status})
                        logging.debug(msg, extra=extra_log)
                        return {"error": response_text, "status": response.status}

                    if "json" in response.headers.get("Content-Type"):
                        response_data = await response.json()
                    else:
                        logging.error(f"Received non-JSON response from {api_name} API", extra=extra_log)
                        response_data = {"data": response_text}

                    if log_success:
                        logging.info("API request has been processed", extra=extra_log)
                    else:
                        logging.debug("API request has been processed", extra=extra_log)
                    break
    except aiohttp.ClientConnectorError as exc:
        logging.error("API request failed", extra=extra_log | {"error": str(exc), "attempt": attempt})
        raise RESTAPIError(400, "HTTP connection has been broken unexpectedly.", "")

    return response_data


async def graphql_query(
    endpoint: str,
    query_or_mutation: str,
    variables: Optional[Dict] = None,
    headers: Optional[Dict[str, str]] = None,
    log_success: bool = False,
    api_name: Optional[str] = "GitHub",
    unsecure: bool = False,
    timeout: int = 30
) -> Dict:
    """
    Perform a GraphQL query or mutation.

    :param endpoint: Host and path of the GraphQL endpoint (e.g., "api.github.com/graphql").
    :param query_or_mutation: The GraphQL query or mutation string.
    :param variables: A dict of variables for the GraphQL operation.
    :param headers: HTTP headers to include in the request.
    :param log_success: If True, logs successful responses at INFO level.
    :param api_name: Friendly name for logging; defaults to endpoint.
    :param unsecure: If True, use HTTP rather than HTTPS.
    :param timeout: Total request timeout in seconds.
    :return: Parsed JSON data from the GraphQL response.
    :raises QueryError: For network or HTTP errors.
    """
    url = f'{"http" if unsecure else "https"}://{endpoint}'
    api_name = api_name or endpoint
    variables = variables or {}
    headers = headers or {"Content-Type": "application/json"}

    payload = {"query": query_or_mutation, "variables": variables}
    client_timeout = aiohttp.ClientTimeout(total=timeout)
    log_extra = {"API": api_name, "endpoint": endpoint, "query": query_or_mutation, "variables": variables}
    try:
        async with aiohttp.ClientSession(timeout=client_timeout) as session:
            logging.debug("Performing GraphQL request", extra={"API": api_name, "endpoint": endpoint})
            async with session.post(url, json=payload, headers=headers) as resp:
                text = await resp.text()
                if resp.status != 200:
                    msg = "HTTP error during GraphQL request"
                    logging.error(msg, extra=log_extra | {"status": resp.status, "body": text})
                    raise RESTAPIError(resp.status, msg, text)

                data = await resp.json()

    except Exception as e:
        logging.error("GraphQL request failed", extra=log_extra | {"description": str(e)})
        raise

    if "errors" in data:
        logging.error("GraphQL returned errors", extra=log_extra | {"response": data})
        raise GraphQLError(data["errors"])

    if log_success:
        logging.info("GraphQL request succeeded", extra=log_extra | {"response": data})

    return data
