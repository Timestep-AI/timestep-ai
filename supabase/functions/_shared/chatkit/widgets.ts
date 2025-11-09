// ChatKit Widgets - TypeScript equivalent of widgets.py
// This file contains all widget component types for ChatKit UI

import type { ActionConfig } from './actions.ts';

// ============================================================================
// Base Types and Literals
// ============================================================================

export type RadiusValue =
  | "2xs" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "full" | "100%" | "none";
/** Allowed corner radius tokens. */

export type TextAlign = "start" | "center" | "end";
/** Horizontal text alignment options. */

export type TextSize = "xs" | "sm" | "md" | "lg" | "xl";
/** Body text size tokens. */

export type IconSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
/** Icon size tokens. */

export type TitleSize = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl";
/** Title text size tokens. */

export type CaptionSize = "sm" | "md" | "lg";
/** Caption text size tokens. */

export type Alignment = "start" | "center" | "end" | "baseline" | "stretch";
/** Flexbox alignment options. */

export type Justification = "start" | "center" | "end" | "between" | "around" | "evenly" | "stretch";
/** Flexbox justification options. */

export type ControlVariant = "solid" | "soft" | "outline" | "ghost";
/** Button and input style variants. */

export type ControlSize = "3xs" | "2xs" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
/** Button and input size variants. */

export type WidgetIcon =
  | "agent" | "analytics" | "atom" | "batch" | "bolt" | "book-open" | "book-clock"
  | "book-closed" | "bug" | "calendar" | "chart" | "check" | "check-circle"
  | "check-circle-filled" | "chevron-left" | "chevron-right" | "circle-question"
  | "compass" | "confetti" | "cube" | "desktop" | "document" | "dot" | "dots-horizontal"
  | "dots-vertical" | "empty-circle" | "external-link" | "globe" | "keys" | "lab"
  | "images" | "info" | "lifesaver" | "lightbulb" | "mail" | "map-pin" | "maps"
  | "mobile" | "name" | "notebook" | "notebook-pencil" | "page-blank" | "phone"
  | "play" | "plus" | "profile" | "profile-card" | "reload" | "star" | "star-filled"
  | "search" | "sparkle" | "sparkle-double" | "square-code" | "square-image"
  | "square-text" | "suitcase" | "settings-slider" | "user" | "wreath" | "write"
  | "write-alt" | "write-alt2";
/** Icon names accepted by widgets that render icons. */

export type CurveType =
  | "basis" | "basisClosed" | "basisOpen" | "bumpX" | "bumpY" | "bump"
  | "linear" | "linearClosed" | "natural" | "monotoneX" | "monotoneY" | "monotone"
  | "step" | "stepBefore" | "stepAfter";
/** Interpolation curve types for `area` and `line` series. */

// ============================================================================
// Helper Types
// ============================================================================

export interface ThemeColor {
  /** Color values for light and dark themes. */
  dark: string;
  /** Color to use when the theme is dark. */
  light: string;
  /** Color to use when the theme is light. */
}

export interface Spacing {
  /** Shorthand spacing values applied to a widget. */
  top?: number | string;
  /** Top spacing; accepts a spacing unit or CSS string. */
  right?: number | string;
  /** Right spacing; accepts a spacing unit or CSS string. */
  bottom?: number | string;
  /** Bottom spacing; accepts a spacing unit or CSS string. */
  left?: number | string;
  /** Left spacing; accepts a spacing unit or CSS string. */
  x?: number | string;
  /** Horizontal spacing; accepts a spacing unit or CSS string. */
  y?: number | string;
  /** Vertical spacing; accepts a spacing unit or CSS string. */
}

export interface Border {
  /** Border style definition for an edge. */
  size: number;
  /** Thickness of the border in px. */
  color?: string | ThemeColor;
  /** Border color; accepts border color token, a primitive color token, a CSS string, or theme-aware `{ light, dark }`.
   * Valid tokens: `default` `subtle` `strong`
   * Primitive color token: e.g. `red-100`, `blue-900`, `gray-500`
   */
  style?: "solid" | "dashed" | "dotted" | "double" | "groove" | "ridge" | "inset" | "outset";
  /** Border line style. */
}

export interface Borders {
  /** Composite border configuration applied across edges. */
  top?: number | Border;
  /** Top border or thickness in px. */
  right?: number | Border;
  /** Right border or thickness in px. */
  bottom?: number | Border;
  /** Bottom border or thickness in px. */
  left?: number | Border;
  /** Left border or thickness in px. */
  x?: number | Border;
  /** Horizontal borders or thickness in px. */
  y?: number | Border;
  /** Vertical borders or thickness in px. */
}

export interface MinMax {
  /** Integer minimum/maximum bounds. */
  min?: number;
  /** Minimum value (inclusive). */
  max?: number;
  /** Maximum value (inclusive). */
}

export interface EditableProps {
  /** Editable field options for text widgets. */
  name: string;
  /** The name of the form control field used when submitting forms. */
  autoFocus?: boolean;
  /** Autofocus the editable input when it appears. */
  autoSelect?: boolean;
  /** Select all text on focus. */
  autoComplete?: string;
  /** Native autocomplete hint for the input. */
  allowAutofillExtensions?: boolean;
  /** Allow browser password/autofill extensions. */
  pattern?: string;
  /** Regex pattern for input validation. */
  placeholder?: string;
  /** Placeholder text for the editable input. */
  required?: boolean;
  /** Mark the editable input as required. */
}

export interface WidgetStatusWithFavicon {
  /** Widget status representation using a favicon. */
  text: string;
  /** Status text to display. */
  favicon?: string;
  /** URL of a favicon to render at the start of the status. */
  frame?: boolean;
  /** Show a frame around the favicon for contrast. */
}

export interface WidgetStatusWithIcon {
  /** Widget status representation using an icon. */
  text: string;
  /** Status text to display. */
  icon?: WidgetIcon;
  /** Icon to render at the start of the status. */
}

export type WidgetStatus = WidgetStatusWithFavicon | WidgetStatusWithIcon;
/** Union for representing widget status messaging. */

export interface CardAction {
  /** Configuration for confirm/cancel actions within a card. */
  label: string;
  /** Button label shown in the card footer. */
  action: ActionConfig;
  /** Declarative action dispatched to the host application. */
}

export interface SelectOption {
  /** Selectable option used by the ``Select`` widget. */
  value: string;
  /** Option value submitted with the form. */
  label: string;
  /** Human-readable label for the option. */
  disabled?: boolean;
  /** Disable the option. */
  description?: string;
  /** Displayed as secondary text below the option `label`. */
}

export interface RadioOption {
  /** Option inside a ``RadioGroup`` widget. */
  label: string;
  /** Label displayed next to the radio option. */
  value: string;
  /** Value submitted when the radio option is selected. */
  disabled?: boolean;
  /** Disables a specific radio option. */
}

export interface XAxisConfig {
  /** Configuration object for the X axis. */
  dataKey: string;
  /** Field name from each data row to use for X-axis categories. */
  hide?: boolean;
  /** Hide the X axis line, ticks, and labels when true. */
  labels?: Record<string, string>;
  /** Custom mapping of tick values to display labels. */
}

export interface BarSeries {
  /** A bar series plotted from a numeric `dataKey`. Supports stacking. */
  type: "bar";
  label?: string;
  /** Legend label for the series. */
  dataKey: string;
  /** Field name from each data row that contains the numeric value. */
  stack?: string;
  /** Optional stack group ID. Series with the same ID stack together. */
  color?: string | ThemeColor;
  /** Color for the series; accepts chart color token, a primitive color token, a CSS string, or theme-aware { light, dark }.
   * Chart color tokens: `blue` `purple` `orange` `green` `red` `yellow` `pink`
   * Primitive color token, e.g., `red-100`, `blue-900`, `gray-500`
   * Note: By default, a color will be sequentially assigned from the chart series colors.
   */
}

export interface AreaSeries {
  /** An area series plotted from a numeric `dataKey`. Supports stacking and curves. */
  type: "area";
  label?: string;
  /** Legend label for the series. */
  dataKey: string;
  /** Field name from each data row that contains the numeric value. */
  stack?: string;
  /** Optional stack group ID. Series with the same ID stack together. */
  color?: string | ThemeColor;
  /** Color for the series; accepts chart color token, a primitive color token, a CSS string, or theme-aware { light, dark }.
   * Chart color tokens: `blue` `purple` `orange` `green` `red` `yellow` `pink`
   * Primitive color token, e.g., `red-100`, `blue-900`, `gray-500`
   * Note: By default, a color will be sequentially assigned from the chart series colors.
   */
  curveType?: CurveType | null;
  /** Interpolation curve type used to connect points. */
}

export interface LineSeries {
  /** A line series plotted from a numeric `dataKey`. Supports curves. */
  type: "line";
  label?: string;
  /** Legend label for the series. */
  dataKey: string;
  /** Field name from each data row that contains the numeric value. */
  color?: string | ThemeColor;
  /** Color for the series; accepts chart color token, a primitive color token, a CSS string, or theme-aware { light, dark }.
   * Chart color tokens: `blue` `purple` `orange` `green` `red` `yellow` `pink`
   * Primitive color token, e.g., `red-100`, `blue-900`, `gray-500`
   * Note: By default, a color will be sequentially assigned from the chart series colors.
   */
  curveType?: CurveType | null;
  /** Interpolation curve type used to connect points. */
}

export type Series = BarSeries | AreaSeries | LineSeries;
/** Union of all supported chart series types. */

// ============================================================================
// Base Widget Component
// ============================================================================

export interface WidgetComponentBase {
  /** Base interface for all ChatKit widget components. */
  key?: string;
  id?: string;
  type: string;
}

// ============================================================================
// Widget Components
// ============================================================================

export interface ListViewItem extends WidgetComponentBase {
  /** Single row inside a ``ListView`` component. */
  type: "ListViewItem";
  children: WidgetComponent[];
  /** Content for the list item. */
  onClickAction?: ActionConfig | null;
  /** Optional action triggered when the list item is clicked. */
  gap?: number | string | null;
  /** Gap between children within the list item; spacing unit or CSS string. */
  align?: Alignment | null;
  /** Y-axis alignment for content within the list item. */
}

export interface ListView extends WidgetComponentBase {
  /** Container component for rendering collections of list items. */
  type: "ListView";
  children: ListViewItem[];
  /** Items to render in the list. */
  limit?: number | "auto" | null;
  /** Max number of items to show before a "Show more" control. */
  status?: WidgetStatus | null;
  /** Optional status header displayed above the list. */
  theme?: "light" | "dark" | null;
  /** Force light or dark theme for this subtree. */
}

export interface Card extends WidgetComponentBase {
  /** Versatile container used for structuring widget content. */
  type: "Card";
  asForm?: boolean | null;
  /** Treat the card as an HTML form so confirm/cancel capture form data. */
  children: WidgetComponent[];
  /** Child components rendered inside the card. */
  background?: string | ThemeColor | null;
  /** Background color; accepts background color token, a primitive color token, a CSS string, or theme-aware `{ light, dark }`.
   * Valid tokens: `surface` `surface-secondary` `surface-tertiary` `surface-elevated` `surface-elevated-secondary`
   * Primitive color token: e.g. `red-100`, `blue-900`, `gray-500`
   */
  size?: "sm" | "md" | "lg" | "full" | null;
  /** Visual size of the card; accepts a size token. No preset default is documented. */
  padding?: number | string | Spacing | null;
  /** Inner spacing of the card; spacing unit, CSS string, or padding object. */
  status?: WidgetStatus | null;
  /** Optional status header displayed above the card. */
  collapsed?: boolean | null;
  /** Collapse card body after the main action has completed. */
  confirm?: CardAction | null;
  /** Confirmation action button shown in the card footer. */
  cancel?: CardAction | null;
  /** Cancel action button shown in the card footer. */
  theme?: "light" | "dark" | null;
  /** Force light or dark theme for this subtree. */
}

export interface Markdown extends WidgetComponentBase {
  /** Widget rendering Markdown content, optionally streamed. */
  type: "Markdown";
  value: string;
  /** Markdown source string to render. */
  streaming?: boolean | null;
  /** Applies streaming-friendly transitions for incremental updates. */
}

export interface Text extends WidgetComponentBase {
  /** Widget rendering plain text with typography controls. */
  type: "Text";
  value: string;
  /** Text content to display. */
  streaming?: boolean | null;
  /** Enables streaming-friendly transitions for incremental updates. */
  italic?: boolean | null;
  /** Render text in italic style. */
  lineThrough?: boolean | null;
  /** Render text with a line-through decoration. */
  color?: string | ThemeColor | null;
  /** Text color; accepts a text color token, a primitive color token, a CSS color string, or a theme-aware `{ light, dark }`.
   * Text color tokens: `prose` `primary` `emphasis` `secondary` `tertiary` `success` `warning` `danger`
   * Primitive color token: e.g. `red-100`, `blue-900`, `gray-500`
   */
  weight?: "normal" | "medium" | "semibold" | "bold" | null;
  /** Font weight; accepts a font weight token. */
  width?: number | string | null;
  /** Constrain the text container width; px or CSS string. */
  size?: TextSize | null;
  /** Size of the text; accepts a text size token. */
  textAlign?: TextAlign | null;
  /** Horizontal text alignment. */
  truncate?: boolean | null;
  /** Truncate overflow with ellipsis. */
  minLines?: number | null;
  /** Reserve space for a minimum number of lines. */
  maxLines?: number | null;
  /** Limit text to a maximum number of lines (line clamp). */
  editable?: false | EditableProps | null;
  /** Enable inline editing for this text node. */
}

export interface Title extends WidgetComponentBase {
  /** Widget rendering prominent headline text. */
  type: "Title";
  value: string;
  /** Text content to display. */
  color?: string | ThemeColor | null;
  /** Text color; accepts a text color token, a primitive color token, a CSS color string, or a theme-aware `{ light, dark }`.
   * Text color tokens: `prose` `primary` `emphasis` `secondary` `tertiary` `success` `warning` `danger`
   * Primitive color token: e.g. `red-100`, `blue-900`, `gray-500`
   */
  weight?: "normal" | "medium" | "semibold" | "bold" | null;
  /** Font weight; accepts a font weight token. */
  size?: TitleSize | null;
  /** Size of the title text; accepts a title size token. */
  textAlign?: TextAlign | null;
  /** Horizontal text alignment. */
  truncate?: boolean | null;
  /** Truncate overflow with ellipsis. */
  maxLines?: number | null;
  /** Limit text to a maximum number of lines (line clamp). */
}

export interface Caption extends WidgetComponentBase {
  /** Widget rendering supporting caption text. */
  type: "Caption";
  value: string;
  /** Text content to display. */
  color?: string | ThemeColor | null;
  /** Text color; accepts a text color token, a primitive color token, a CSS color string, or a theme-aware `{ light, dark }`.
   * Text color tokens: `prose` `primary` `emphasis` `secondary` `tertiary` `success` `warning` `danger`
   * Primitive color token: e.g. `red-100`, `blue-900`, `gray-500`
   */
  weight?: "normal" | "medium" | "semibold" | "bold" | null;
  /** Font weight; accepts a font weight token. */
  size?: CaptionSize | null;
  /** Size of the caption text; accepts a caption size token. */
  textAlign?: TextAlign | null;
  /** Horizontal text alignment. */
  truncate?: boolean | null;
  /** Truncate overflow with ellipsis. */
  maxLines?: number | null;
  /** Limit text to a maximum number of lines (line clamp). */
}

export interface Badge extends WidgetComponentBase {
  /** Small badge indicating status or categorization. */
  type: "Badge";
  label: string;
  /** Text to display inside the badge. */
  color?: "secondary" | "success" | "danger" | "warning" | "info" | "discovery" | null;
  /** Color of the badge; accepts a badge color token. */
  variant?: "solid" | "soft" | "outline" | null;
  /** Visual style of the badge. */
  size?: "sm" | "md" | "lg" | null;
  /** Size of the badge. */
  pill?: boolean | null;
  /** Determines if the badge should be fully rounded (pill). */
}

export interface BoxBase {
  /** Shared layout props for flexible container widgets. */
  children?: WidgetComponent[] | null;
  /** Child components to render inside the container. */
  align?: Alignment | null;
  /** Cross-axis alignment of children. */
  justify?: Justification | null;
  /** Main-axis distribution of children. */
  wrap?: "nowrap" | "wrap" | "wrap-reverse" | null;
  /** Wrap behavior for flex items. */
  flex?: number | string | null;
  /** Flex growth/shrink factor. */
  gap?: number | string | null;
  /** Gap between direct children; spacing unit or CSS string. */
  height?: number | string | null;
  /** Explicit height; px or CSS string. */
  width?: number | string | null;
  /** Explicit width; px or CSS string. */
  size?: number | string | null;
  /** Shorthand to set both width and height; px or CSS string. */
  minHeight?: number | string | null;
  /** Minimum height; px or CSS string. */
  minWidth?: number | string | null;
  /** Minimum width; px or CSS string. */
  minSize?: number | string | null;
  /** Shorthand to set both minWidth and minHeight; px or CSS string. */
  maxHeight?: number | string | null;
  /** Maximum height; px or CSS string. */
  maxWidth?: number | string | null;
  /** Maximum width; px or CSS string. */
  maxSize?: number | string | null;
  /** Shorthand to set both maxWidth and maxHeight; px or CSS string. */
  padding?: number | string | Spacing | null;
  /** Inner padding; spacing unit, CSS string, or padding object. */
  margin?: number | string | Spacing | null;
  /** Outer margin; spacing unit, CSS string, or margin object. */
  border?: number | Border | Borders | null;
  /** Border applied to the container; px or border object/shorthand. */
  radius?: RadiusValue | null;
  /** Border radius; accepts a radius token. */
  background?: string | ThemeColor | null;
  /** Background color; accepts background color token, a primitive color token, a CSS string, or theme-aware `{ light, dark }`.
   * Valid tokens: `surface` `surface-secondary` `surface-tertiary` `surface-elevated` `surface-elevated-secondary`
   * Primitive color token: e.g. `red-100`, `blue-900`, `gray-500`
   */
  aspectRatio?: number | string | null;
  /** Aspect ratio of the box (e.g., 16/9); number or CSS string. */
}

export interface Box extends WidgetComponentBase, BoxBase {
  /** Generic flex container with direction control. */
  type: "Box";
  direction?: "row" | "col" | null;
  /** Flex direction for content within this container. */
}

export interface Row extends WidgetComponentBase, BoxBase {
  /** Horizontal flex container. */
  type: "Row";
}

export interface Col extends WidgetComponentBase, BoxBase {
  /** Vertical flex container. */
  type: "Col";
}

export interface Form extends WidgetComponentBase, BoxBase {
  /** Form wrapper capable of submitting ``onSubmitAction``. */
  type: "Form";
  onSubmitAction?: ActionConfig | null;
  /** Action dispatched when the form is submitted. */
  direction?: "row" | "col" | null;
  /** Flex direction for laying out form children. */
}

export interface Divider extends WidgetComponentBase {
  /** Visual divider separating content sections. */
  type: "Divider";
  color?: string | ThemeColor | null;
  /** Divider color; accepts border color token, a primitive color token, a CSS string, or theme-aware `{ light, dark }`.
   * Valid tokens: `default` `subtle` `strong`
   * Primitive color token: e.g. `red-100`, `blue-900`, `gray-500`
   */
  size?: number | string | null;
  /** Thickness of the divider line; px or CSS string. */
  spacing?: number | string | null;
  /** Outer spacing above and below the divider; spacing unit or CSS string. */
  flush?: boolean | null;
  /** Flush the divider to the container edge, removing surrounding padding. */
}

export interface Icon extends WidgetComponentBase {
  /** Icon component referencing a built-in icon name. */
  type: "Icon";
  name: WidgetIcon;
  /** Name of the icon to display. */
  color?: string | ThemeColor | null;
  /** Icon color; accepts a text color token, a primitive color token, a CSS color string, or a theme-aware `{ light, dark }`.
   * Text color tokens: `prose` `primary` `emphasis` `secondary` `tertiary` `success` `warning` `danger`
   * Primitive color token: e.g. `red-100`, `blue-900`, `gray-500`
   */
  size?: IconSize | null;
  /** Size of the icon; accepts an icon size token. */
}

export interface Image extends WidgetComponentBase {
  /** Image component with sizing and fitting controls. */
  type: "Image";
  src: string;
  /** Image URL source. */
  alt?: string | null;
  /** Alternate text for accessibility. */
  fit?: "cover" | "contain" | "fill" | "scale-down" | "none" | null;
  /** How the image should fit within the container. */
  position?: "top left" | "top" | "top right" | "left" | "center" | "right" | "bottom left" | "bottom" | "bottom right" | null;
  /** Focal position of the image within the container. */
  radius?: RadiusValue | null;
  /** Border radius; accepts a radius token. */
  frame?: boolean | null;
  /** Draw a subtle frame around the image. */
  flush?: boolean | null;
  /** Flush the image to the container edge, removing surrounding padding. */
  height?: number | string | null;
  /** Explicit height; px or CSS string. */
  width?: number | string | null;
  /** Explicit width; px or CSS string. */
  size?: number | string | null;
  /** Shorthand to set both width and height; px or CSS string. */
  minHeight?: number | string | null;
  /** Minimum height; px or CSS string. */
  minWidth?: number | string | null;
  /** Minimum width; px or CSS string. */
  minSize?: number | string | null;
  /** Shorthand to set both minWidth and minHeight; px or CSS string. */
  maxHeight?: number | string | null;
  /** Maximum height; px or CSS string. */
  maxWidth?: number | string | null;
  /** Maximum width; px or CSS string. */
  maxSize?: number | string | null;
  /** Shorthand to set both maxWidth and maxHeight; px or CSS string. */
  margin?: number | string | Spacing | null;
  /** Outer margin; spacing unit, CSS string, or margin object. */
  background?: string | ThemeColor | null;
  /** Background color; accepts background color token, a primitive color token, a CSS string, or theme-aware `{ light, dark }`.
   * Valid tokens: `surface` `surface-secondary` `surface-tertiary` `surface-elevated` `surface-elevated-secondary`
   * Primitive color token: e.g. `red-100`, `blue-900`, `gray-500`
   */
  aspectRatio?: number | string | null;
  /** Aspect ratio of the box (e.g., 16/9); number or CSS string. */
  flex?: number | string | null;
  /** Flex growth/shrink factor. */
}

export interface Button extends WidgetComponentBase {
  /** Button component optionally wired to an action. */
  type: "Button";
  submit?: boolean | null;
  /** Configure the button as a submit button for the nearest form. */
  label?: string | null;
  /** Text to display inside the button. */
  onClickAction?: ActionConfig | null;
  /** Action dispatched on click. */
  iconStart?: WidgetIcon | null;
  /** Icon shown before the label; can be used for icon-only buttons. */
  iconEnd?: WidgetIcon | null;
  /** Optional icon shown after the label. */
  style?: "primary" | "secondary" | null;
  /** Convenience preset for button style. */
  iconSize?: "sm" | "md" | "lg" | "xl" | "2xl" | null;
  /** Controls the size of icons within the button; accepts an icon size token. */
  color?: "primary" | "secondary" | "info" | "discovery" | "success" | "caution" | "warning" | "danger" | null;
  /** Color of the button; accepts a button color token. */
  variant?: ControlVariant | null;
  /** Visual variant of the button; accepts a control variant token. */
  size?: ControlSize | null;
  /** Controls the overall size of the button. */
  pill?: boolean | null;
  /** Determines if the button should be fully rounded (pill). */
  uniform?: boolean | null;
  /** Determines if the button should have matching width and height. */
  block?: boolean | null;
  /** Extend the button to 100% of the available width. */
  disabled?: boolean | null;
  /** Disable interactions and apply disabled styles. */
}

export interface Spacer extends WidgetComponentBase {
  /** Flexible spacer used to push content apart. */
  type: "Spacer";
  minSize?: number | string | null;
  /** Minimum size the spacer should occupy along the flex direction. */
}

export interface Select extends WidgetComponentBase {
  /** Select dropdown component. */
  type: "Select";
  name: string;
  /** The name of the form control field used when submitting forms. */
  options: SelectOption[];
  /** List of selectable options. */
  onChangeAction?: ActionConfig | null;
  /** Action dispatched when the value changes. */
  placeholder?: string | null;
  /** Placeholder text shown when no value is selected. */
  defaultValue?: string | null;
  /** Initial value of the select. */
  variant?: ControlVariant | null;
  /** Visual style of the select; accepts a control variant token. */
  size?: ControlSize | null;
  /** Controls the size of the select control. */
  pill?: boolean | null;
  /** Determines if the select should be fully rounded (pill). */
  block?: boolean | null;
  /** Extend the select to 100% of the available width. */
  clearable?: boolean | null;
  /** Show a clear control to unset the value. */
  disabled?: boolean | null;
  /** Disable interactions and apply disabled styles. */
}

export interface DatePicker extends WidgetComponentBase {
  /** Date picker input component. */
  type: "DatePicker";
  name: string;
  /** The name of the form control field used when submitting forms. */
  onChangeAction?: ActionConfig | null;
  /** Action dispatched when the date value changes. */
  placeholder?: string | null;
  /** Placeholder text shown when no date is selected. */
  defaultValue?: Date | null;
  /** Initial value of the date picker. */
  min?: Date | null;
  /** Earliest selectable date (inclusive). */
  max?: Date | null;
  /** Latest selectable date (inclusive). */
  variant?: ControlVariant | null;
  /** Visual variant of the datepicker control. */
  size?: ControlSize | null;
  /** Controls the size of the datepicker control. */
  side?: "top" | "bottom" | "left" | "right" | null;
  /** Preferred side to render the calendar. */
  align?: "start" | "center" | "end" | null;
  /** Preferred alignment of the calendar relative to the control. */
  pill?: boolean | null;
  /** Determines if the datepicker should be fully rounded (pill). */
  block?: boolean | null;
  /** Extend the datepicker to 100% of the available width. */
  clearable?: boolean | null;
  /** Show a clear control to unset the value. */
  disabled?: boolean | null;
  /** Disable interactions and apply disabled styles. */
}

export interface Checkbox extends WidgetComponentBase {
  /** Checkbox input component. */
  type: "Checkbox";
  name: string;
  /** The name of the form control field used when submitting forms. */
  label?: string | null;
  /** Optional label text rendered next to the checkbox. */
  defaultChecked?: string | null;
  /** The initial checked state of the checkbox. */
  onChangeAction?: ActionConfig | null;
  /** Action dispatched when the checked state changes. */
  disabled?: boolean | null;
  /** Disable interactions and apply disabled styles. */
  required?: boolean | null;
  /** Mark the checkbox as required for form submission. */
}

export interface Input extends WidgetComponentBase {
  /** Single-line text input component. */
  type: "Input";
  name: string;
  /** The name of the form control field used when submitting forms. */
  inputType?: "number" | "email" | "text" | "password" | "tel" | "url" | null;
  /** Native input type. */
  defaultValue?: string | null;
  /** Initial value of the input. */
  required?: boolean | null;
  /** Mark the input as required for form submission. */
  pattern?: string | null;
  /** Regex pattern for input validation. */
  placeholder?: string | null;
  /** Placeholder text shown when empty. */
  allowAutofillExtensions?: boolean | null;
  /** Allow password managers / autofill extensions to appear. */
  autoSelect?: boolean | null;
  /** Select all contents of the input when it mounts. */
  autoFocus?: boolean | null;
  /** Autofocus the input when it mounts. */
  disabled?: boolean | null;
  /** Disable interactions and apply disabled styles. */
  variant?: "soft" | "outline" | null;
  /** Visual style of the input. */
  size?: ControlSize | null;
  /** Controls the size of the input control. */
  gutterSize?: "2xs" | "xs" | "sm" | "md" | "lg" | "xl" | null;
  /** Controls gutter on the edges of the input; overrides value from `size`. */
  pill?: boolean | null;
  /** Determines if the input should be fully rounded (pill). */
}

export interface Label extends WidgetComponentBase {
  /** Form label associated with a field. */
  type: "Label";
  value: string;
  /** Text content of the label. */
  fieldName: string;
  /** Name of the field this label describes. */
  size?: TextSize | null;
  /** Size of the label text; accepts a text size token. */
  weight?: "normal" | "medium" | "semibold" | "bold" | null;
  /** Font weight; accepts a font weight token. */
  textAlign?: TextAlign | null;
  /** Horizontal text alignment. */
  color?: string | ThemeColor | null;
  /** Text color; accepts a text color token, a primitive color token, a CSS color string, or a theme-aware `{ light, dark }`.
   * Text color tokens: `prose` `primary` `emphasis` `secondary` `tertiary` `success` `warning` `danger`
   * Primitive color token: e.g. `red-100`, `blue-900`, `gray-500`
   */
}

export interface RadioGroup extends WidgetComponentBase {
  /** Grouped radio input control. */
  type: "RadioGroup";
  name: string;
  /** The name of the form control field used when submitting forms. */
  options?: RadioOption[] | null;
  /** Array of options to render as radio items. */
  ariaLabel?: string | null;
  /** Accessible label for the radio group; falls back to `name`. */
  onChangeAction?: ActionConfig | null;
  /** Action dispatched when the selected value changes. */
  defaultValue?: string | null;
  /** Initial selected value of the radio group. */
  direction?: "row" | "col" | null;
  /** Layout direction of the radio items. */
  disabled?: boolean | null;
  /** Disable interactions and apply disabled styles for the entire group. */
  required?: boolean | null;
  /** Mark the group as required for form submission. */
}

export interface Textarea extends WidgetComponentBase {
  /** Multiline text input component. */
  type: "Textarea";
  name: string;
  /** The name of the form control field used when submitting forms. */
  defaultValue?: string | null;
  /** Initial value of the textarea. */
  required?: boolean | null;
  /** Mark the textarea as required for form submission. */
  pattern?: string | null;
  /** Regex pattern for input validation. */
  placeholder?: string | null;
  /** Placeholder text shown when empty. */
  autoSelect?: boolean | null;
  /** Select all contents of the textarea when it mounts. */
  autoFocus?: boolean | null;
  /** Autofocus the textarea when it mounts. */
  disabled?: boolean | null;
  /** Disable interactions and apply disabled styles. */
  variant?: "soft" | "outline" | null;
  /** Visual style of the textarea. */
  size?: ControlSize | null;
  /** Controls the size of the textarea control. */
  gutterSize?: "2xs" | "xs" | "sm" | "md" | "lg" | "xl" | null;
  /** Controls gutter on the edges of the textarea; overrides value from `size`. */
  rows?: number | null;
  /** Initial number of visible rows. */
  autoResize?: boolean | null;
  /** Automatically grow/shrink to fit content. */
  maxRows?: number | null;
  /** Maximum number of rows when auto-resizing. */
  allowAutofillExtensions?: boolean | null;
  /** Allow password managers / autofill extensions to appear. */
}

export interface Transition extends WidgetComponentBase {
  /** Wrapper enabling transitions for a child component. */
  type: "Transition";
  children?: WidgetComponent | null;
  /** The child component to animate layout changes for. */
}

export interface Chart extends WidgetComponentBase {
  /** Data visualization component for simple bar/line/area charts. */
  type: "Chart";
  data: Array<Record<string, string | number>>;
  /** Tabular data for the chart, where each row maps field names to values. */
  series: Series[];
  /** One or more series definitions that describe how to visualize data fields. */
  xAxis: string | XAxisConfig;
  /** X-axis configuration; either a `dataKey` string or a config object. */
  showYAxis?: boolean | null;
  /** Controls whether the Y axis is rendered. */
  showLegend?: boolean | null;
  /** Controls whether a legend is rendered. */
  showTooltip?: boolean | null;
  /** Controls whether a tooltip is rendered when hovering over a datapoint. */
  barGap?: number | null;
  /** Gap between bars within the same category (in px). */
  barCategoryGap?: number | null;
  /** Gap between bar categories/groups (in px). */
  flex?: number | string | null;
  /** Flex growth/shrink factor for layout. */
  height?: number | string | null;
  /** Explicit height; px or CSS string. */
  width?: number | string | null;
  /** Explicit width; px or CSS string. */
  size?: number | string | null;
  /** Shorthand to set both width and height; px or CSS string. */
  minHeight?: number | string | null;
  /** Minimum height; px or CSS string. */
  minWidth?: number | string | null;
  /** Minimum width; px or CSS string. */
  minSize?: number | string | null;
  /** Shorthand to set both minWidth and minHeight; px or CSS string. */
  maxHeight?: number | string | null;
  /** Maximum height; px or CSS string. */
  maxWidth?: number | string | null;
  /** Maximum width; px or CSS string. */
  maxSize?: number | string | null;
  /** Shorthand to set both maxWidth and maxHeight; px or CSS string. */
  aspectRatio?: number | string | null;
  /** Aspect ratio of the chart area (e.g., 16/9); number or CSS string. */
}

// ============================================================================
// Widget Component Union Types
// ============================================================================

export type WidgetComponent =
  | Text
  | Title
  | Caption
  | Chart
  | Badge
  | Markdown
  | Box
  | Row
  | Col
  | Divider
  | Icon
  | Image
  | ListViewItem
  | Button
  | Checkbox
  | Spacer
  | Select
  | DatePicker
  | Form
  | Input
  | Label
  | RadioGroup
  | Textarea
  | Transition;
/** Union of all renderable widget components. */

export type WidgetRoot = Card | ListView;
/** Union of widget root types (top-level widgets). */

// ============================================================================
// Widget Serialization Helper
// ============================================================================

/**
 * Recursively remove None/null/undefined values when serializing widgets.
 * Matches Python's _drop_none function behavior.
 */
export function dropNone(x: any): any {
  if (typeof x === 'object' && x !== null && !Array.isArray(x)) {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(x)) {
      if (k === 'children' || (v !== null && v !== undefined)) {
        result[k] = dropNone(v);
      }
    }
    return result;
  }
  if (Array.isArray(x)) {
    return x.filter(v => v !== null && v !== undefined).map(dropNone);
  }
  return x;
}

