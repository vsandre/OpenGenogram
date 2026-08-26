import { Suspense } from "react";

import EditRoute from "../components/EditRoute";

export default function EditPage() {
  return (
    <main className="editor-workspace-page" aria-label="Genogram editor workspace">
      <Suspense fallback={<div className="editor-route-loading">Loading local project…</div>}>
        <EditRoute />
      </Suspense>
    </main>
  );
}
