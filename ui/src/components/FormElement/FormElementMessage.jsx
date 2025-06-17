export const FormElementMessage = ({ isCritical, children, ...props }) => {
  return (
    <div
      {...props}
      className={`mt-1 text-sm ${isCritical ? "text-destructive" : "text-muted-foreground"}`}
    >
      {children}
    </div>
  );
};
