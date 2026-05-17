"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Search, Loader2 } from "lucide-react";
import { useDebounce } from "@/lib/hooks/useDebounce";

interface TenorGif {
  id: string;
  title: string;
  media: Array<{
    gif?: { url: string; dims: [number, number] };
    tinygif?: { url: string; dims: [number, number] };
    nanogif?: { url: string; dims: [number, number] };
  }>;
}

interface Props {
  children: React.ReactNode;
  onSelect: (gifUrl: string, title: string) => void;
}

export function GifPicker({ children, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<TenorGif[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 400);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchGifs = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/gifs/search?q=${encodeURIComponent(q)}&limit=20`);
      if (!res.ok) return;
      const data = await res.json();
      setGifs(data.results ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchGifs(debouncedQuery);
  }, [open, debouncedQuery, fetchGifs]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setGifs([]);
    }
  }, [open]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="end"
          sideOffset={8}
          className="z-[120] w-[340px] rounded-lg border border-[var(--border)] bg-[#1a1d21] shadow-[0_8px_32px_rgba(0,0,0,0.5)] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <div className="border-b border-[#3f4144] p-2">
            <div className="flex h-8 items-center gap-2 rounded-md border border-[#565856] bg-[#2c2d30] px-2 text-[#ababad] focus-within:border-white">
              <Search className="h-3.5 w-3.5 flex-shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search GIFs"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-[#d1d2d3] outline-none placeholder:text-[#ababad]"
              />
            </div>
          </div>

          <div className="h-[300px] overflow-y-auto p-2">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-[#ababad]" />
              </div>
            ) : gifs.length === 0 ? (
              <div className="flex h-full items-center justify-center text-[13px] text-[#6c6f75]">
                {query ? "No GIFs found" : "Type to search…"}
              </div>
            ) : (
              <div className="columns-2 gap-1.5 space-y-1.5">
                {gifs.map((gif) => {
                  const media = gif.media[0];
                  const preview = media?.tinygif ?? media?.nanogif ?? media?.gif;
                  const full = media?.gif ?? media?.tinygif;
                  if (!preview || !full) return null;
                  return (
                    <Popover.Close asChild key={gif.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(full.url, gif.title)}
                        className="block w-full overflow-hidden rounded-md bg-[#2c2d30] transition-opacity hover:opacity-90"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={preview.url}
                          alt={gif.title}
                          className="w-full"
                          loading="lazy"
                        />
                      </button>
                    </Popover.Close>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-[#3f4144] px-3 py-1.5 text-[10px] text-[#6c6f75]">
            Powered by Tenor
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
