export type AvatarShape = "circle" | "rounded" | "square";
export type AvatarTone = "hashed" | "neutral";
interface Props {
    /** Name of the person or account: the accessible name and the source of the initials. */
    name: string;
    /** Picture URL. Without one, or when it fails to load, the initials show. */
    src?: string | null | undefined;
    /** Stable key the initials' color derives from, such as a user ID or an
     * email address. Defaults to `name`. */
    colorKey?: string | undefined;
    /** Replaces the initials derived from `name`, such as one letter for a domain. */
    initials?: string | undefined;
    /** `hashed` gives each key its own accent; `neutral` is a plain grey tile. */
    tone?: AvatarTone;
    /** Width and height in pixels. */
    size?: number;
    /** `circle` for people; `rounded` and `square` tell organizations or domains apart. */
    shape?: AvatarShape;
    /** Hides the avatar from assistive technology when the name is already
     * written beside it. */
    decorative?: boolean;
    class?: string;
}
declare const Avatar: import("svelte").Component<Props, {}, "">;
type Avatar = ReturnType<typeof Avatar>;
export default Avatar;
