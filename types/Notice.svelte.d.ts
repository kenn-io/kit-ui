export type NoticeTone = "info" | "success" | "warning" | "error";
interface Props {
    tone?: NoticeTone;
    toneLabel?: string;
    title?: string;
    message: string;
    actionLabel?: string;
    onaction?: () => void;
}
declare const Notice: import("svelte").Component<Props, {}, "">;
type Notice = ReturnType<typeof Notice>;
export default Notice;
