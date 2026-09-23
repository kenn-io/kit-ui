import type { Snippet } from "svelte";
import { type CardTone } from "./Card.svelte";
interface Props {
    /** Uppercase event label ("comment", "review", "merged"…). */
    typeLabel?: string | undefined;
    /** Accent for the label and, by convention, the timeline dot. */
    tone?: CardTone | undefined;
    author?: string | undefined;
    /** Pre-formatted timestamp ("2h ago") — the app owns formatting/i18n. */
    time?: string | undefined;
    /** Header-to-body spacing. Use `none` when rich content owns its outer spacing. */
    bodyGap?: "none" | "sm";
    class?: string;
    /** Trailing header content — edit / copy-link icon buttons. */
    actions?: Snippet;
    /** The comment body (e.g. a rendered Markdown component). Omit it for a
     * header-only system-event row. */
    children?: Snippet;
}
declare const CommentCard: import("svelte").Component<Props, {}, "">;
type CommentCard = ReturnType<typeof CommentCard>;
export default CommentCard;
