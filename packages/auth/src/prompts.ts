import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

export async function promptText(label: string) {
  const readline = createInterface({ input: stdin, output: stdout });

  try {
    return (await readline.question(label)).trim();
  } finally {
    readline.close();
  }
}

export async function promptHidden(label: string) {
  if (!stdin.isTTY || !stdout.isTTY || !stdin.setRawMode) {
    throw new Error(
      "A TTY is required for a hidden password prompt. Use --password-stdin instead.",
    );
  }

  stdout.write(label);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");

  return new Promise<string>((resolve, reject) => {
    let value = "";

    const cleanup = () => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
    };

    const onData = (chunk: string | Buffer) => {
      for (const character of chunk.toString()) {
        if (character === "\r" || character === "\n") {
          cleanup();
          resolve(value);
          return;
        }

        if (character === "\u0003") {
          cleanup();
          reject(new Error("Password entry cancelled."));
          return;
        }

        if (character === "\u007f" || character === "\b") {
          if (value.length > 0) {
            value = value.slice(0, -1);
            stdout.write("\b \b");
          }
          continue;
        }

        if (character >= " ") {
          value += character;
          stdout.write("•");
        }
      }
    };

    stdin.on("data", onData);
  });
}

export async function readPasswordFromStdin() {
  let input = "";

  for await (const chunk of stdin) {
    input += chunk.toString();
  }

  return input.replace(/\r?\n$/, "");
}
