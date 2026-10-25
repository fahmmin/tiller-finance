// glob that returns forward-slash paths (C:/...), so Synpress's cache builder can hand them to tsup on Windows.
import { glob as globAny } from "glob";
export * from "glob";
export const glob = async (pattern, options) => (await globAny(pattern, options)).map((f) => f.replaceAll("\\", "/"));
