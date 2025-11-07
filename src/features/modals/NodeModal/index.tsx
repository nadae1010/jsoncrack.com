import React from "react";
import type { ModalProps } from "@mantine/core";
import {
  Modal,
  Stack,
  Text,
  ScrollArea,
  Flex,
  CloseButton,
  Button,
} from "@mantine/core";
import { CodeHighlight } from "@mantine/code-highlight";

import type { NodeData } from "../../../types/graph";
import useGraph from "../../editor/views/GraphView/stores/useGraph";
import useFile from "../../../store/useFile"; // 👈 this is the important one

// Build JSON snippet for the modal from the node rows
function buildContentFromNode(node: NodeData | null): string {
  if (!node || !node.text || node.text.length === 0) return "";

  const rows = node.text;

  // Leaf node without key → just show its value
  if (rows.length === 1 && !rows[0].key) {
    const v = rows[0].value;
    return typeof v === "string" ? v : JSON.stringify(v, null, 2);
  }

  const obj: Record<string, unknown> = {};

  rows.forEach((row) => {
    if (row.key && row.type !== "array" && row.type !== "object") {
      obj[row.key] = row.value;
    }
  });

  return Object.keys(obj).length ? JSON.stringify(obj, null, 2) : "";
}

// Convert JSON path array into `$["fruits"][0]`
function jsonPathToString(path?: (string | number)[]): string {
  if (!path || path.length === 0) return "$";

  const segments = path.map((seg) =>
    typeof seg === "number" ? `${seg}` : `"${seg}"`
  );

  return `$[${segments.join("][")}]`;
}

export const NodeModal = ({ opened, onClose }: ModalProps) => {
  const nodeData = useGraph((state) => state.selectedNode) as NodeData | null;

  // from useFile store (left editor)
  const getContents = useFile((state) => state.getContents);
  const setContents = useFile((state) => state.setContents);

  const [isEditing, setIsEditing] = React.useState(false);
  const [originalContent, setOriginalContent] = React.useState("");
  const [draft, setDraft] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  // Sync when selected node changes
  React.useEffect(() => {
    const next = buildContentFromNode(nodeData);
    setOriginalContent(next);
    setDraft(next);
    setError(null);
  }, [nodeData]);


  const handleEdit = () => {
    setIsEditing(true);
    setDraft(originalContent);
    setError(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setDraft(originalContent);
    setError(null);
  };

  const handleSave = () => {
    if (!nodeData || !nodeData.path || nodeData.path.length === 0) {
      setIsEditing(false);
      return;
    }

    const trimmed = draft.trim();
    if (!trimmed) {
      setError("Content cannot be empty.");
      return;
    }

    // Parse edited content
    let newValue: any;
    try {
      newValue = JSON.parse(trimmed);
    } catch {
      // allow simple scalar / string edits
      newValue = draft;
    }

    try {
      // Get current JSON from the left editor
      const current = getContents();
      const root =
        current && current.trim().length
          ? JSON.parse(current)
          : {};

      const updated = JSON.parse(JSON.stringify(root)); // simple deep clone
      const path = nodeData.path as (string | number)[];

      // Walk to parent container
      let cursor: any = updated;
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        if (cursor[key as any] === undefined) {
          throw new Error("Invalid JSON path");
        }
        cursor = cursor[key as any];
      }

      // Set new value
      const lastKey = path[path.length - 1];
      cursor[lastKey as any] = newValue;

      const updatedJson = JSON.stringify(updated, null, 2);

      // 🔑 This updates:
      // - left JSON editor (useFile.contents)
      // - useJson + graph via existing logic in useFile
      setContents({ contents: updatedJson, hasChanges: true });

      setOriginalContent(draft);
      setDraft(draft);   
      setIsEditing(false);
      setError(null);
    } catch (e) {
      console.error(e);
      setError("Failed to save changes.");
    }
  };

  const handleClose = () => {
    setIsEditing(false);
    setDraft(originalContent);
    setError(null);
    onClose?.();
  };

  const pathText = jsonPathToString(nodeData?.path as any);
  const contentToShow = isEditing ? draft : originalContent || "";

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      size="lg"
      centered
      withCloseButton={false}
      radius="md"
    >
      {/* Header */}
      <Flex justify="space-between" align="center" mb="xs">
        <Text fw={500}>Node Content</Text>

        <Flex align="center" gap="xs">
          {isEditing ? (
            <>
              <Button size="xs" color="green" onClick={handleSave}>
                Save
              </Button>
              <Button size="xs" variant="default" onClick={handleCancel}>
                Cancel
              </Button>
            </>
          ) : (
            <Button size="xs" variant="outline" onClick={handleEdit}>
              Edit
            </Button>
          )}
          <CloseButton onClick={handleClose} />
        </Flex>
      </Flex>

      {/* Body */}
      <Stack gap="sm">
        {/* Content */}
        <Stack gap={4}>
          <Text size="sm" fw={500}>
            Content
          </Text>
          <ScrollArea
            type="auto"
            styles={{ viewport: { maxHeight: 260 } }}
          >
            {isEditing ? (
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                style={{
                  width: "100%",
                  minHeight: 180,
                  padding: 8,
                  borderRadius: 4,
                  border: "1px solid var(--mantine-color-dark-4)",
                  fontFamily: "monospace",
                  fontSize: 12,
                  background: "var(--mantine-color-dark-7)",
                  color: "inherit",
                  resize: "vertical",
                }}
              />
            ) : (
              <CodeHighlight
                code={
                  contentToShow || "// No editable scalar values for this node"
                }
                language="json"
                withCopyButton={false}
              />
            )}
          </ScrollArea>
          {error && (
            <Text size="xs" c="red">
              {error}
            </Text>
          )}
        </Stack>

        {/* JSON Path */}
        <Stack gap={4}>
          <Text size="sm" fw={500}>
            JSON Path
          </Text>
          <CodeHighlight
            code={pathText}
            language="json"
            withCopyButton={false}
          />
        </Stack>
      </Stack>
    </Modal>
  );
};
