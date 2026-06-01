import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Type, Image, Minus, AlignLeft, Square, Trash2,
  ChevronUp, ChevronDown, Code, Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Block =
  | { id: string; type: "heading"; text: string; level: 1 | 2 | 3 }
  | { id: string; type: "text"; text: string }
  | { id: string; type: "button"; text: string; url: string; color: string }
  | { id: string; type: "divider" }
  | { id: string; type: "image"; src: string; alt: string }
  | { id: string; type: "spacer"; height: number };

const BLOCK_TYPES = [
  { type: "heading", label: "Título", icon: Type },
  { type: "text", label: "Texto", icon: AlignLeft },
  { type: "button", label: "Botão", icon: Square },
  { type: "divider", label: "Divisor", icon: Minus },
  { type: "image", label: "Imagem", icon: Image },
  { type: "spacer", label: "Espaço", icon: Minus },
] as const;

function makeBlock(type: string): Block {
  const id = `block_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  switch (type) {
    case "heading": return { id, type: "heading", text: "Título do e-mail", level: 1 };
    case "text": return { id, type: "text", text: "Escreva seu texto aqui. Use {{nome}} para personalizar." };
    case "button": return { id, type: "button", text: "Clique aqui", url: "https://setaembalagens.com.br", color: "#1a3264" };
    case "divider": return { id, type: "divider" };
    case "image": return { id, type: "image", src: "", alt: "" };
    case "spacer": return { id, type: "spacer", height: 24 };
    default: return { id, type: "text", text: "" };
  }
}

function blocksToHtml(blocks: Block[]): string {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1f2937;">
${blocks.map((b) => {
  switch (b.type) {
    case "heading": {
      const sizes: Record<number, string> = { 1: "24px", 2: "20px", 3: "16px" };
      return `<h${b.level} style="font-size:${sizes[b.level]};font-weight:700;color:#1a3264;margin:0 0 12px;">${b.text}</h${b.level}>`;
    }
    case "text":
      return `<p style="font-size:14px;line-height:1.6;color:#374151;margin:0 0 12px;">${b.text.replace(/\n/g, "<br>")}</p>`;
    case "button":
      return `<div style="text-align:center;margin:16px 0;"><a href="${b.url}" style="display:inline-block;background:${b.color};color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">${b.text}</a></div>`;
    case "divider":
      return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;">`;
    case "image":
      return b.src ? `<img src="${b.src}" alt="${b.alt}" style="max-width:100%;border-radius:6px;margin:8px 0;">` : "";
    case "spacer":
      return `<div style="height:${b.height}px;"></div>`;
    default:
      return "";
  }
}).join("\n")}
</div>`;
}

type Props = {
  value: string;
  onChange: (html: string) => void;
};

export function EmailBlockEditor({ value, onChange }: Props) {
  const [mode, setMode] = useState<"visual" | "html">("visual");
  const [blocks, setBlocks] = useState<Block[]>([
    makeBlock("heading"),
    makeBlock("text"),
    makeBlock("button"),
  ]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  const updateBlock = (id: string, updates: Partial<Block>) => {
    setBlocks((prev) => {
      const next = prev.map((b) => b.id === id ? { ...b, ...updates } as Block : b);
      onChange(blocksToHtml(next));
      return next;
    });
  };

  const addBlock = (type: string) => {
    const newBlock = makeBlock(type);
    setBlocks((prev) => {
      const next = [...prev, newBlock];
      onChange(blocksToHtml(next));
      return next;
    });
    setEditingId(newBlock.id);
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => {
      const next = prev.filter((b) => b.id !== id);
      onChange(blocksToHtml(next));
      return next;
    });
    if (editingId === id) setEditingId(null);
  };

  const moveBlock = (id: string, dir: -1 | 1) => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      onChange(blocksToHtml(next));
      return next;
    });
  };

  if (mode === "html") {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">HTML</Label>
          <Button size="sm" variant="outline" onClick={() => setMode("visual")}>
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            Editor visual
          </Button>
        </div>
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={12}
          className="font-mono text-xs"
          placeholder="<h1>Olá {{nome}}</h1>"
        />
        <p className="text-xs text-muted-foreground">Variáveis: {"{{nome}}"}, {"{{empresa}}"}, {"{{email}}"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Editor visual</Label>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => setPreview(!preview)}>
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            {preview ? "Editar" : "Preview"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setMode("html")}>
            <Code className="mr-1.5 h-3.5 w-3.5" />
            HTML
          </Button>
        </div>
      </div>

      {preview ? (
        <div
          className="rounded-lg border bg-white p-4 text-sm text-black min-h-[200px] max-h-[400px] overflow-y-auto"
          dangerouslySetInnerHTML={{ __html: blocksToHtml(blocks).replace(/\{\{nome\}\}/gi, "João").replace(/\{\{empresa\}\}/gi, "Empresa X") }}
        />
      ) : (
        <div className="rounded-lg border bg-muted/20 p-3 space-y-2 min-h-[200px]">
          {blocks.map((block, idx) => (
            <div
              key={block.id}
              className={cn(
                "group relative rounded-md border bg-card p-3 cursor-pointer transition-all",
                editingId === block.id ? "border-primary ring-1 ring-primary" : "hover:border-primary/50",
              )}
              onClick={() => setEditingId(block.id === editingId ? null : block.id)}
            >
              {/* Block controls */}
              <div className="absolute right-2 top-2 hidden items-center gap-1 group-hover:flex">
                <button onClick={(e) => { e.stopPropagation(); moveBlock(block.id, -1); }} className="rounded p-0.5 hover:bg-muted" disabled={idx === 0}>
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); moveBlock(block.id, 1); }} className="rounded p-0.5 hover:bg-muted" disabled={idx === blocks.length - 1}>
                  <ChevronDown className="h-3 w-3" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); removeBlock(block.id); }} className="rounded p-0.5 hover:bg-destructive/10 text-destructive">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>

              {/* Block preview */}
              {block.type === "heading" && (
                <div>
                  {editingId === block.id ? (
                    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                      <Input value={block.text} onChange={(e) => updateBlock(block.id, { text: e.target.value })} className="font-bold text-lg" />
                      <select value={block.level} onChange={(e) => updateBlock(block.id, { level: parseInt(e.target.value) as 1|2|3 })} className="text-xs border rounded px-2 py-1">
                        <option value={1}>H1 — Grande</option>
                        <option value={2}>H2 — Médio</option>
                        <option value={3}>H3 — Pequeno</option>
                      </select>
                    </div>
                  ) : (
                    <p className={cn("font-bold text-primary", block.level === 1 ? "text-xl" : block.level === 2 ? "text-lg" : "text-base")}>{block.text}</p>
                  )}
                </div>
              )}

              {block.type === "text" && (
                editingId === block.id ? (
                  <Textarea value={block.text} onChange={(e) => updateBlock(block.id, { text: e.target.value })} rows={3} onClick={(e) => e.stopPropagation()} />
                ) : (
                  <p className="text-sm text-muted-foreground line-clamp-2">{block.text}</p>
                )
              )}

              {block.type === "button" && (
                editingId === block.id ? (
                  <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                    <Input value={block.text} onChange={(e) => updateBlock(block.id, { text: e.target.value })} placeholder="Texto do botão" />
                    <Input value={block.url} onChange={(e) => updateBlock(block.id, { url: e.target.value })} placeholder="URL" />
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Cor:</Label>
                      <input type="color" value={block.color} onChange={(e) => updateBlock(block.id, { color: e.target.value })} className="h-7 w-10 cursor-pointer rounded border" />
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-center">
                    <span className="rounded px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: block.color }}>{block.text}</span>
                  </div>
                )
              )}

              {block.type === "divider" && <hr className="border-border" />}

              {block.type === "image" && (
                editingId === block.id ? (
                  <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                    <Input value={block.src} onChange={(e) => updateBlock(block.id, { src: e.target.value })} placeholder="URL da imagem" />
                    <Input value={block.alt} onChange={(e) => updateBlock(block.id, { alt: e.target.value })} placeholder="Texto alternativo" />
                  </div>
                ) : (
                  block.src ? <img src={block.src} alt={block.alt} className="max-h-24 rounded" /> : <p className="text-xs text-muted-foreground">🖼️ Imagem — clique para configurar</p>
                )
              )}

              {block.type === "spacer" && (
                editingId === block.id ? (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Label className="text-xs">Altura (px):</Label>
                    <Input type="number" value={block.height} onChange={(e) => updateBlock(block.id, { height: parseInt(e.target.value) || 16 })} className="w-20" />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">↕ Espaço ({block.height}px)</p>
                )
              )}
            </div>
          ))}

          {/* Add block buttons */}
          <div className="flex flex-wrap gap-1.5 pt-2 border-t">
            {BLOCK_TYPES.map((bt) => {
              const Icon = bt.icon;
              return (
                <button
                  key={bt.type}
                  onClick={() => addBlock(bt.type)}
                  className="flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-xs hover:bg-accent"
                >
                  <Icon className="h-3 w-3" />
                  {bt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
