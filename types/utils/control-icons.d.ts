export type ControlIcon = "expand" | "copy" | "reset" | "check";
export declare function loadControlIcons(): Promise<void>;
export declare function setControlIcon(button: HTMLButtonElement, icon: ControlIcon): void;
