"use client";

import { useRender } from "@base-ui/react/use-render";
import * as React from "react";

import { VisuallyHiddenInput } from "~/components/visually-hidden-input";
import { useDirection } from "~/components/ui/direction";
import { useAsRef } from "~/hooks/use-as-ref";
import { useIsomorphicLayoutEffect } from "~/hooks/use-isomorphic-layout-effect";
import { useLazyRef } from "~/hooks/use-lazy-ref";
import { useComposedRefs } from "~/lib/compose-refs";
import { cn } from "~/lib/utils";

/**
 * A field that reads as text until it is clicked, and is an input from then
 * until it is left. From the DiceUI registry (`@diceui/editable`), with its two
 * Radix primitives swapped for the Base UI ones this app already runs on:
 * `Slot`/`asChild` becomes the `render` prop every other component here takes,
 * and the direction comes from our own `DirectionProvider`.
 *
 * One behaviour is ours: Enter commits a single-line field, but only ⌘/Ctrl+Enter
 * commits a multi-line one — a paragraph needs Enter for its own paragraphs.
 */

const ROOT_NAME = "Editable";
const LABEL_NAME = "EditableLabel";
const AREA_NAME = "EditableArea";
const PREVIEW_NAME = "EditablePreview";
const INPUT_NAME = "EditableInput";
const TRIGGER_NAME = "EditableTrigger";
const TOOLBAR_NAME = "EditableToolbar";
const CANCEL_NAME = "EditableCancel";
const SUBMIT_NAME = "EditableSubmit";

type Direction = "ltr" | "rtl";

/**
 * Two optional flags, either of which turns a behaviour on. A function because
 * `a ?? b` would let an explicit `false` win over a `true`, and `a || b` on two
 * optional booleans is exactly the shape the linter reads as a mistaken `??`.
 */
function either(first?: boolean, second?: boolean) {
  return first === true || second === true;
}

/** Every part can be rendered as something else, Base UI style. */
type RenderProp = { render?: useRender.RenderProp };

type RootElement = HTMLDivElement;
type PreviewElement = HTMLDivElement;
type SubmitElement = HTMLButtonElement;
/** The editing control is an input or, where the text has paragraphs, a textarea. */
type InputElement = HTMLInputElement | HTMLTextAreaElement;

interface StoreState {
  value: string;
  editing: boolean;
}

interface Store {
  subscribe: (callback: () => void) => () => void;
  getState: () => StoreState;
  setState: <K extends keyof StoreState>(key: K, value: StoreState[K]) => void;
  notify: () => void;
}

const StoreContext = React.createContext<Store | null>(null);

function useStoreContext(consumerName: string) {
  const context = React.useContext(StoreContext);
  if (!context) {
    throw new Error(`\`${consumerName}\` must be used within \`${ROOT_NAME}\``);
  }
  return context;
}

function useStore<T>(
  selector: (state: StoreState) => T,
  ogStore?: Store | null,
): T {
  const contextStore = React.useContext(StoreContext);

  const store = ogStore ?? contextStore;

  if (!store) {
    throw new Error(`\`useStore\` must be used within \`${ROOT_NAME}\``);
  }

  const getSnapshot = React.useCallback(
    () => selector(store.getState()),
    [store, selector],
  );

  return React.useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

interface EditableContextValue {
  rootId: string;
  inputId: string;
  labelId: string;
  defaultValue: string;
  onCancel: () => void;
  onEdit: () => void;
  onSubmit: (value: string) => void;
  onEnterKeyDown?: (event: KeyboardEvent) => void;
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
  dir?: Direction;
  maxLength?: number;
  placeholder?: string;
  triggerMode: "click" | "dblclick" | "focus";
  autosize: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  invalid?: boolean;
}

const EditableContext = React.createContext<EditableContextValue | null>(null);

function useEditableContext(consumerName: string) {
  const context = React.useContext(EditableContext);
  if (!context) {
    throw new Error(`\`${consumerName}\` must be used within \`${ROOT_NAME}\``);
  }
  return context;
}

interface EditableProps
  extends Omit<React.ComponentProps<"div">, "onSubmit">, RenderProp {
  id?: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  defaultEditing?: boolean;
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
  onCancel?: () => void;
  onEdit?: () => void;
  onSubmit?: (value: string) => void;
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
  onEnterKeyDown?: (event: KeyboardEvent) => void;
  dir?: Direction;
  maxLength?: number;
  name?: string;
  placeholder?: string;
  triggerMode?: EditableContextValue["triggerMode"];
  autosize?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  invalid?: boolean;
}

function Editable(props: EditableProps) {
  const {
    value: valueProp,
    defaultValue = "",
    defaultEditing,
    editing: editingProp,
    onValueChange,
    onEditingChange,
    onCancel: onCancelProp,
    onEdit: onEditProp,
    onSubmit: onSubmitProp,
    onEscapeKeyDown,
    onEnterKeyDown,
    dir: dirProp,
    maxLength,
    name,
    placeholder,
    triggerMode = "click",
    render,
    autosize = false,
    disabled,
    required,
    readOnly,
    invalid,
    className,
    id,
    ref,
    ...rootProps
  } = props;

  const instanceId = React.useId();
  const rootId = id ?? instanceId;

  const inputId = React.useId();
  const labelId = React.useId();

  const contextDir = useDirection();
  const dir = dirProp ?? contextDir;

  const previousValueRef = React.useRef(defaultValue);

  const [formTrigger, setFormTrigger] = React.useState<RootElement | null>(
    null,
  );
  const composedRef = useComposedRefs<RootElement>(ref, (node) => {
    setFormTrigger(node);
  });
  const isFormControl = formTrigger ? !!formTrigger.closest("form") : true;

  const listenersRef = useLazyRef(() => new Set<() => void>());
  const stateRef = useLazyRef<StoreState>(() => ({
    value: valueProp ?? defaultValue,
    editing: editingProp ?? defaultEditing ?? false,
  }));

  const propsRef = useAsRef({
    onValueChange,
    onEditingChange,
    onCancel: onCancelProp,
    onEdit: onEditProp,
    onSubmit: onSubmitProp,
    onEscapeKeyDown,
    onEnterKeyDown,
  });

  const store = React.useMemo<Store>(() => {
    return {
      subscribe: (cb) => {
        listenersRef.current.add(cb);
        return () => listenersRef.current.delete(cb);
      },
      getState: () => stateRef.current,
      setState: (key, value) => {
        if (Object.is(stateRef.current[key], value)) return;

        if (key === "value" && typeof value === "string") {
          stateRef.current.value = value;
          propsRef.current.onValueChange?.(value);
        } else if (key === "editing" && typeof value === "boolean") {
          stateRef.current.editing = value;
          propsRef.current.onEditingChange?.(value);
        } else {
          stateRef.current[key] = value;
        }

        store.notify();
      },
      notify: () => {
        for (const cb of listenersRef.current) {
          cb();
        }
      },
    };
  }, [listenersRef, stateRef, propsRef]);

  const value = useStore((state) => state.value, store);

  useIsomorphicLayoutEffect(() => {
    if (valueProp !== undefined) {
      store.setState("value", valueProp);
    }
  }, [valueProp]);

  useIsomorphicLayoutEffect(() => {
    if (editingProp !== undefined) {
      store.setState("editing", editingProp);
    }
  }, [editingProp]);

  const onCancel = React.useCallback(() => {
    const prevValue = previousValueRef.current;
    store.setState("value", prevValue);
    store.setState("editing", false);
    propsRef.current.onCancel?.();
  }, [store, propsRef]);

  const onEdit = React.useCallback(() => {
    const currentValue = store.getState().value;
    previousValueRef.current = currentValue;
    store.setState("editing", true);
    propsRef.current.onEdit?.();
  }, [store, propsRef]);

  const onSubmit = React.useCallback(
    (newValue: string) => {
      store.setState("value", newValue);
      store.setState("editing", false);
      propsRef.current.onSubmit?.(newValue);
    },
    [store, propsRef],
  );

  const contextValue = React.useMemo<EditableContextValue>(
    () => ({
      rootId,
      inputId,
      labelId,
      defaultValue,
      onSubmit,
      onEdit,
      onCancel,
      onEscapeKeyDown,
      onEnterKeyDown,
      dir,
      maxLength,
      placeholder,
      triggerMode,
      autosize,
      disabled,
      readOnly,
      required,
      invalid,
    }),
    [
      rootId,
      inputId,
      labelId,
      defaultValue,
      onSubmit,
      onCancel,
      onEdit,
      onEscapeKeyDown,
      onEnterKeyDown,
      dir,
      maxLength,
      placeholder,
      triggerMode,
      autosize,
      disabled,
      required,
      readOnly,
      invalid,
    ],
  );

  const rootElement = useRender({
    render,
    ref: composedRef,
    defaultTagName: "div",
    props: {
      "data-slot": "editable",
      ...rootProps,
      id,
      className: cn("flex min-w-0 flex-col gap-2", className),
    },
  });

  return (
    <StoreContext.Provider value={store}>
      <EditableContext.Provider value={contextValue}>
        {rootElement}
        {isFormControl && (
          <VisuallyHiddenInput
            type="hidden"
            control={formTrigger}
            name={name}
            value={value}
            disabled={disabled}
            readOnly={readOnly}
            required={required}
          />
        )}
      </EditableContext.Provider>
    </StoreContext.Provider>
  );
}

interface EditableLabelProps
  extends React.ComponentProps<"label">, RenderProp {}

function EditableLabel(props: EditableLabelProps) {
  const { render, className, children, ref, ...labelProps } = props;
  const context = useEditableContext(LABEL_NAME);

  return useRender({
    render,
    ref,
    defaultTagName: "label",
    props: {
      "data-disabled": context.disabled ? "" : undefined,
      "data-invalid": context.invalid ? "" : undefined,
      "data-required": context.required ? "" : undefined,
      "data-slot": "editable-label",
      ...labelProps,
      id: context.labelId,
      htmlFor: context.inputId,
      className: cn(
        "data-required:after:text-destructive text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 data-required:after:ml-0.5 data-required:after:content-['*']",
        className,
      ),
      children,
    },
  });
}

interface EditableAreaProps extends React.ComponentProps<"div">, RenderProp {}

function EditableArea(props: EditableAreaProps) {
  const { render, className, ref, ...areaProps } = props;
  const context = useEditableContext(AREA_NAME);
  const editing = useStore((state) => state.editing);

  return useRender({
    render,
    ref,
    defaultTagName: "div",
    props: {
      role: "group",
      "data-disabled": context.disabled ? "" : undefined,
      "data-editing": editing ? "" : undefined,
      "data-slot": "editable-area",
      dir: context.dir,
      ...areaProps,
      className: cn(
        "relative inline-block min-w-0 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      ),
    },
  });
}

interface EditablePreviewProps
  extends React.ComponentProps<"div">, RenderProp {}

function EditablePreview(props: EditablePreviewProps) {
  const {
    onClick: onClickProp,
    onDoubleClick: onDoubleClickProp,
    onFocus: onFocusProp,
    onKeyDown: onKeyDownProp,
    render,
    className,
    ref,
    ...previewProps
  } = props;

  const context = useEditableContext(PREVIEW_NAME);
  const value = useStore((state) => state.value);
  const editing = useStore((state) => state.editing);

  const propsRef = useAsRef({
    onClick: onClickProp,
    onDoubleClick: onDoubleClickProp,
    onFocus: onFocusProp,
    onKeyDown: onKeyDownProp,
  });

  const isDisabled = either(context.disabled);
  const isReadOnly = either(context.readOnly);

  const onTrigger = React.useCallback(() => {
    if (isDisabled || isReadOnly) return;
    context.onEdit();
  }, [context, isDisabled, isReadOnly]);

  const onClick = React.useCallback(
    (event: React.MouseEvent<PreviewElement>) => {
      propsRef.current.onClick?.(event);
      if (event.defaultPrevented || context.triggerMode !== "click") return;

      onTrigger();
    },
    [propsRef, onTrigger, context.triggerMode],
  );

  const onDoubleClick = React.useCallback(
    (event: React.MouseEvent<PreviewElement>) => {
      propsRef.current.onDoubleClick?.(event);
      if (event.defaultPrevented || context.triggerMode !== "dblclick") return;

      onTrigger();
    },
    [propsRef, onTrigger, context.triggerMode],
  );

  const onFocus = React.useCallback(
    (event: React.FocusEvent<PreviewElement>) => {
      propsRef.current.onFocus?.(event);
      if (event.defaultPrevented || context.triggerMode !== "focus") return;

      onTrigger();
    },
    [propsRef, onTrigger, context.triggerMode],
  );

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent<PreviewElement>) => {
      propsRef.current.onKeyDown?.(event);
      if (event.defaultPrevented) return;

      if (event.key === "Enter") {
        const nativeEvent = event.nativeEvent;
        if (context.onEnterKeyDown) {
          context.onEnterKeyDown(nativeEvent);
          if (nativeEvent.defaultPrevented) return;
        }
        onTrigger();
      }
    },
    [propsRef, onTrigger, context],
  );

  return useRender({
    render,
    ref,
    defaultTagName: "div",
    enabled: !editing && !isReadOnly,
    props: {
      role: "button",
      "aria-disabled": isDisabled || isReadOnly,
      "data-empty": !value ? "" : undefined,
      "data-disabled": isDisabled ? "" : undefined,
      "data-readonly": isReadOnly ? "" : undefined,
      "data-slot": "editable-preview",
      tabIndex: isDisabled || isReadOnly ? undefined : 0,
      ...previewProps,
      onClick,
      onDoubleClick,
      onFocus,
      onKeyDown,
      className: cn(
        "focus-visible:ring-ring data-empty:text-muted-foreground cursor-text truncate rounded-sm border border-transparent py-1 text-base focus-visible:outline-hidden focus-visible:ring-1 data-disabled:cursor-not-allowed data-disabled:opacity-50 data-readonly:cursor-default md:text-sm",
        className,
      ),
      children: value || context.placeholder,
    },
  });
}

/** A textarea takes Enter for itself; only a single-line control commits on it. */
function isMultiline(element: EventTarget | null) {
  return element instanceof HTMLTextAreaElement;
}

interface EditableInputProps
  extends Omit<React.ComponentProps<"input">, "ref">, RenderProp {
  ref?: React.Ref<InputElement>;
  maxLength?: number;
}

function EditableInput(props: EditableInputProps) {
  const {
    onBlur: onBlurProp,
    onChange: onChangeProp,
    onKeyDown: onKeyDownProp,
    render,
    className,
    disabled,
    readOnly,
    required,
    maxLength,
    ref,
    ...inputProps
  } = props;

  const context = useEditableContext(INPUT_NAME);
  const store = useStoreContext(INPUT_NAME);
  const value = useStore((state) => state.value);
  const editing = useStore((state) => state.editing);
  const inputRef = React.useRef<InputElement>(null);
  const composedRef = useComposedRefs<InputElement>(ref, inputRef);

  const propsRef = useAsRef({
    onBlur: onBlurProp,
    onChange: onChangeProp,
    onKeyDown: onKeyDownProp,
  });

  const isDisabled = either(disabled, context.disabled);
  const isReadOnly = either(readOnly, context.readOnly);
  const isRequired = either(required, context.required);

  const onAutosize = React.useCallback(
    (target: InputElement) => {
      if (!context.autosize) return;

      if (target instanceof HTMLTextAreaElement) {
        target.style.height = "0";
        target.style.height = `${String(target.scrollHeight)}px`;
      } else {
        target.style.width = "0";
        target.style.width = `${String(target.scrollWidth + 4)}px`;
      }
    },
    [context.autosize],
  );

  const onBlur = React.useCallback(
    (event: React.FocusEvent<InputElement>) => {
      if (isDisabled || isReadOnly) return;

      propsRef.current.onBlur?.(event as React.FocusEvent<HTMLInputElement>);
      if (event.defaultPrevented) return;

      const relatedTarget = event.relatedTarget;

      /* Leaving for this field's own buttons is not leaving the field. */
      const isAction =
        relatedTarget instanceof HTMLElement &&
        relatedTarget.closest(
          `[data-slot="editable-trigger"], [data-slot="editable-cancel"]`,
        ) !== null;

      if (!isAction) {
        context.onSubmit(value);
      }
    },
    [value, context, propsRef, isDisabled, isReadOnly],
  );

  const onChange = React.useCallback(
    (event: React.ChangeEvent<InputElement>) => {
      if (isDisabled || isReadOnly) return;

      propsRef.current.onChange?.(event as React.ChangeEvent<HTMLInputElement>);
      if (event.defaultPrevented) return;

      store.setState("value", event.target.value);
      onAutosize(event.target);
    },
    [store, propsRef, onAutosize, isDisabled, isReadOnly],
  );

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent<InputElement>) => {
      if (isDisabled || isReadOnly) return;

      propsRef.current.onKeyDown?.(
        event as React.KeyboardEvent<HTMLInputElement>,
      );
      if (event.defaultPrevented) return;

      if (event.key === "Escape") {
        const nativeEvent = event.nativeEvent;
        if (context.onEscapeKeyDown) {
          context.onEscapeKeyDown(nativeEvent);
          if (nativeEvent.defaultPrevented) return;
        }
        context.onCancel();
      } else if (event.key === "Enter") {
        /* A paragraph field keeps Enter for its own line breaks, and commits on
         * the shortcut instead. */
        if (!isMultiline(event.currentTarget)) {
          context.onSubmit(value);
        } else if (event.metaKey || event.ctrlKey) {
          event.preventDefault();
          context.onSubmit(value);
        }
      }
    },
    [value, context, propsRef, isDisabled, isReadOnly],
  );

  useIsomorphicLayoutEffect(() => {
    if (!editing || isDisabled || isReadOnly || !inputRef.current) return;

    const frameId = window.requestAnimationFrame(() => {
      if (!inputRef.current) return;

      inputRef.current.focus();
      inputRef.current.select();
      onAutosize(inputRef.current);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [editing, onAutosize, isDisabled, isReadOnly]);

  return useRender({
    render,
    ref: composedRef,
    defaultTagName: "input",
    enabled: editing || isReadOnly,
    props: {
      "aria-required": isRequired,
      "aria-invalid": context.invalid,
      "data-slot": "editable-input",
      dir: context.dir,
      disabled: isDisabled,
      readOnly: isReadOnly,
      required: isRequired,
      ...inputProps,
      id: context.inputId,
      "aria-labelledby": context.labelId,
      maxLength,
      placeholder: context.placeholder,
      value,
      onBlur,
      onChange,
      onKeyDown,
      className: cn(
        "border-input placeholder:text-muted-foreground focus-visible:ring-ring flex rounded-sm border bg-transparent py-1 text-base shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground focus-visible:outline-hidden focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        context.autosize ? "w-auto" : "w-full",
        className,
      ),
    },
  });
}

interface EditableTriggerProps
  extends React.ComponentProps<"button">, RenderProp {
  forceMount?: boolean;
}

function EditableTrigger(props: EditableTriggerProps) {
  const { render, forceMount = false, ref, ...triggerProps } = props;
  const context = useEditableContext(TRIGGER_NAME);
  const editing = useStore((state) => state.editing);

  const isDisabled = either(context.disabled);
  const isReadOnly = either(context.readOnly);

  const onTrigger = React.useCallback(() => {
    if (isDisabled || isReadOnly) return;
    context.onEdit();
  }, [context, isDisabled, isReadOnly]);

  return useRender({
    render,
    ref,
    defaultTagName: "button",
    enabled: forceMount || (!editing && !isReadOnly),
    props: {
      type: "button",
      "aria-controls": context.rootId,
      "aria-disabled": isDisabled || isReadOnly,
      "data-disabled": isDisabled ? "" : undefined,
      "data-readonly": isReadOnly ? "" : undefined,
      "data-slot": "editable-trigger",
      ...triggerProps,
      onClick: context.triggerMode === "click" ? onTrigger : undefined,
      onDoubleClick: context.triggerMode === "dblclick" ? onTrigger : undefined,
    },
  });
}

interface EditableToolbarProps extends React.ComponentProps<"div">, RenderProp {
  orientation?: "horizontal" | "vertical";
}

function EditableToolbar(props: EditableToolbarProps) {
  const {
    render,
    className,
    orientation = "horizontal",
    ref,
    ...toolbarProps
  } = props;
  const context = useEditableContext(TOOLBAR_NAME);

  return useRender({
    render,
    ref,
    defaultTagName: "div",
    props: {
      role: "toolbar",
      "aria-controls": context.rootId,
      "aria-orientation": orientation,
      "data-slot": "editable-toolbar",
      dir: context.dir,
      ...toolbarProps,
      className: cn(
        "flex items-center gap-2",
        orientation === "vertical" && "flex-col",
        className,
      ),
    },
  });
}

interface EditableCancelProps
  extends React.ComponentProps<"button">, RenderProp {}

function EditableCancel(props: EditableCancelProps) {
  const { onClick: onClickProp, render, ref, ...cancelProps } = props;
  const context = useEditableContext(CANCEL_NAME);
  const editing = useStore((state) => state.editing);

  const propsRef = useAsRef({
    onClick: onClickProp,
  });

  const onClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (either(context.disabled, context.readOnly)) return;

      propsRef.current.onClick?.(event);
      if (event.defaultPrevented) return;

      context.onCancel();
    },
    [propsRef, context],
  );

  return useRender({
    render,
    ref,
    defaultTagName: "button",
    enabled: editing || either(context.readOnly),
    props: {
      type: "button",
      "aria-controls": context.rootId,
      "data-slot": "editable-cancel",
      ...cancelProps,
      onClick,
    },
  });
}

interface EditableSubmitProps
  extends React.ComponentProps<"button">, RenderProp {}

function EditableSubmit(props: EditableSubmitProps) {
  const { onClick: onClickProp, render, ref, ...submitProps } = props;
  const context = useEditableContext(SUBMIT_NAME);
  const value = useStore((state) => state.value);
  const editing = useStore((state) => state.editing);

  const propsRef = useAsRef({
    onClick: onClickProp,
  });

  const onClick = React.useCallback(
    (event: React.MouseEvent<SubmitElement>) => {
      if (either(context.disabled, context.readOnly)) return;

      propsRef.current.onClick?.(event);
      if (event.defaultPrevented) return;

      context.onSubmit(value);
    },
    [propsRef, context, value],
  );

  return useRender({
    render,
    ref,
    defaultTagName: "button",
    enabled: editing || either(context.readOnly),
    props: {
      type: "button",
      "aria-controls": context.rootId,
      "data-slot": "editable-submit",
      ...submitProps,
      onClick,
    },
  });
}

export {
  Editable,
  EditableArea,
  EditableCancel,
  EditableInput,
  EditableLabel,
  EditablePreview,
  type EditableProps,
  EditableSubmit,
  EditableToolbar,
  EditableTrigger,
  useStore as useEditable,
};
