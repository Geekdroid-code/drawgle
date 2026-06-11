declare module "@radix-ui/react-toggle-group" {
  import * as React from "react";

  export const Root: React.ForwardRefExoticComponent<
    React.HTMLAttributes<HTMLDivElement> &
      React.RefAttributes<HTMLDivElement>
  >;

  export const Item: React.ForwardRefExoticComponent<
    React.ButtonHTMLAttributes<HTMLButtonElement> &
      React.RefAttributes<HTMLButtonElement>
  >;
}
