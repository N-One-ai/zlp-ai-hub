import { requireActiveWorkspace } from "@/lib/workspace/guards";
import { getBrands } from "@/lib/brand/queries";
import { getVbeeVoicesAction } from "@/lib/voice/actions";
import { VoiceComposer } from "@/components/voice/voice-composer";

export default async function CreateVoicePage() {
  const workspace = await requireActiveWorkspace();
  const [brands, voices] = await Promise.all([getBrands(workspace.workspaceId), getVbeeVoicesAction()]);
  const activeBrands = brands.filter((b) => b.status === "active");

  const voicesResult = voices.ok
    ? ({ ok: true, voices: voices.data } as const)
    : ({ ok: false, code: voices.error.code, message: voices.error.message } as const);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Tạo giọng nói</h1>
        <p className="text-sm text-muted-foreground">Chuyển văn bản thành giọng đọc bằng Vbee Text-to-Speech.</p>
      </div>

      {activeBrands.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Workspace chưa có thương hiệu nào. Liên hệ Admin để tạo thương hiệu trước — Creative Hub cần ít nhất một
          thương hiệu để lưu audio tạo ra vào thư viện.
        </p>
      ) : (
        <VoiceComposer brands={activeBrands} voicesResult={voicesResult} />
      )}
    </div>
  );
}
