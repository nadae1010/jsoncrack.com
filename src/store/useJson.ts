import { create } from "zustand";
import useGraph from "../features/editor/views/GraphView/stores/useGraph";

interface JsonActions {
  setJson: (json: string) => void;
  getJson: () => string;
  clear: () => void;
  updateValueAtPath: (path: (string | number)[], newValue: any) => void;
}

const initialStates = {
  json: "{}",
  loading: true,
};

export type JsonStates = typeof initialStates;

const useJson = create<JsonStates & JsonActions>()((set, get) => ({
  ...initialStates,

  getJson: () => get().json,

  setJson: (json: string) => {
    set({ json, loading: false });
    // keep graph in sync with JSON
    useGraph.getState().setGraph(json);
  },

  clear: () => {
    set({ json: "", loading: false });
    useGraph.getState().clearGraph();
  },

  updateValueAtPath: (path, newValue) => {
    // Use the current JSON from the store
    const current = get().json;

    if (!path || path.length === 0 || !current?.trim()) {
      return;
    }

    try {
      const root = JSON.parse(current);
      const cloned: any = JSON.parse(JSON.stringify(root));

      // Walk down to the parent of the target
      let cursor: any = cloned;
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        if (cursor[key as any] === undefined) {
          // invalid path → do nothing
          return;
        }
        cursor = cursor[key as any];
      }

      const lastKey = path[path.length - 1];
      cursor[lastKey as any] = newValue;

      const updatedJson = JSON.stringify(cloned, null, 2);

      // IMPORTANT: use setJson so both left JSON + graph update
      get().setJson(updatedJson);
    } catch {
      // parsing or path failure → leave state unchanged
      return;
    }
  },
}));

export default useJson;
