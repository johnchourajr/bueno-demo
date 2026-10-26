/** `--name value` from an argument list, or the fallback. */
export function flag(args, name, fallback = null) {
  const i = args.indexOf(name);
  return i === -1 || i === args.length - 1 ? fallback : args[i + 1];
}

/** Positional arguments: everything that isn't a flag or a flag's value. */
export function positional(args, booleans = []) {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      if (!booleans.includes(args[i])) i++;
      continue;
    }
    out.push(args[i]);
  }
  return out;
}
