import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parse, type AST } from "svelte/compiler";

const source = readFileSync(
  new URL("../src/lib/components/DatePhraseInput.svelte", import.meta.url),
  "utf8",
);
const template = parse(source, { modern: true }).fragment;

// Inspect the parsed template, not comments or similarly named script text.
// These are source-level relationship checks, not screen-reader tests.
function* walk(value: unknown): Generator<AST.SvelteNode> {
  if (!value || typeof value !== "object") return;
  if ("type" in value) yield value as AST.SvelteNode;
  for (const child of Object.values(value)) yield* walk(child);
}

function attribute(node: AST.RegularElement | AST.Component, name: string) {
  return node.attributes.find((attr) => attr.type === "Attribute" && attr.name === name);
}

function interpolations(name: string) {
  return [...walk(template)].filter(
    (node) =>
      node.type === "ExpressionTag" &&
      [...walk(node.expression)].some((expr) => expr.type === "Identifier" && expr.name === name),
  );
}

const host = template.nodes.find((node) => node.type === "RegularElement")!;
const description = host.fragment.nodes.find(
  (node) => node.type === "RegularElement" && node.name === "p",
)! as AST.RegularElement;

test("the field keeps a persistent, visible description for help, results and errors", () => {
  const field = [...walk(template)].find(
    (node) => node.type === "Component" && node.name === "TextInput",
  )! as AST.Component;
  const reference = { value: { expression: { type: "Identifier", name: "summaryId" } } };
  expect(attribute(field, "ariaDescribedby")).toMatchObject(reference);
  expect(attribute(description, "id")).toMatchObject(reference);
  expect(attribute(field, "invalid")).toMatchObject({
    value: { expression: { type: "Identifier", name: "invalid" } },
  });
  expect(description.attributes).toContainEqual(
    expect.objectContaining({
      type: "ClassDirective",
      name: "kit-date-phrase-input__summary--invalid",
      expression: expect.objectContaining({ type: "Identifier", name: "invalid" }),
    }),
  );
  expect(attribute(description, "class")).toMatchObject({
    value: [{ type: "Text", data: "kit-date-phrase-input__summary" }],
  });
  for (const node of [host, description]) {
    for (const name of ["aria-hidden", "hidden", "inert", "aria-live"]) {
      expect(attribute(node, name)).toBeUndefined();
    }
  }
});

test("the summary has one exposure in a stable, visible polite live child", () => {
  const live = [...walk(template)].filter(
    (node) => node.type === "RegularElement" && attribute(node, "aria-live"),
  ) as AST.RegularElement[];
  expect(live).toHaveLength(1);
  expect(attribute(live[0]!, "aria-live")).toMatchObject({
    value: [{ type: "Text", data: "polite" }],
  });
  // Direct children stay mounted even when summary is empty. There is no
  // second, hidden copy outside the field's persistent description.
  expect(interpolations("summary")).toHaveLength(1);
  expect(description.fragment.nodes).toContain(live[0]);
  expect(live[0]!.fragment.nodes).toEqual(interpolations("summary"));
  for (const name of ["aria-hidden", "hidden", "inert", "class", "style"]) {
    expect(attribute(live[0]!, name)).toBeUndefined();
  }
});

test("the idle hint is described outside the live child, only while summary is empty", () => {
  const idle = description.fragment.nodes.find((node) => node.type === "IfBlock")!;
  expect(idle).toMatchObject({
    test: { type: "UnaryExpression", operator: "!", argument: { name: "summary" } },
    alternate: null,
  });
  expect(interpolations("hint")).toHaveLength(1);
  expect(idle.consequent.nodes.filter((node) => node.type !== "Text")).toEqual(
    interpolations("hint"),
  );
});
