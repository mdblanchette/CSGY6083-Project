"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/context/WorkspaceContext";

type SearchResult = {
  id: number;
  body: string;
  postedAt: string;
  channelId: number;
  channelName: string;
  channelType: string;
  workspaceId: number;
  workspaceName: string;
  senderName: string | null;
  senderNickname: string | null;
  senderImage: string | null;
};

type Props = {
  searchModalOpen: boolean;
  setSearchModalOpen: (value: boolean) => void;
};

const GlobalSearchModal = ({ searchModalOpen, setSearchModalOpen }: Props) => {
  const { selectWorkspace } = useWorkspace();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens; reset state when it closes
  useEffect(() => {
    if (searchModalOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults(null);
    }
  }, [searchModalOpen]);

  // Close on click outside
  useEffect(() => {
    if (!searchModalOpen) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".gs-modal-content")) {
        setSearchModalOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [searchModalOpen, setSearchModalOpen]);

  // Close on Escape
  useEffect(() => {
    if (!searchModalOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchModalOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [searchModalOpen, setSearchModalOpen]);

  const runSearch = async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      if (res.ok) setResults(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setResults(null);
      return;
    }
    debounceRef.current = setTimeout(() => runSearch(value.trim()), 350);
  };

  const handleResultClick = (result: SearchResult) => {
    selectWorkspace(result.workspaceId);
    router.push(`/?channel=${result.channelId}`);
    setSearchModalOpen(false);
  };

  if (!searchModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-start justify-center bg-black/25 px-4 pt-16 backdrop-blur-sm">
      <div className="gs-modal-content w-full max-w-[600px] overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-dark">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-stroke px-5 py-4 dark:border-dark-3">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"
            className="shrink-0 text-dark-4 dark:text-dark-6">
            <g clipPath="url(#clip0_gs)">
              <path fillRule="evenodd" clipRule="evenodd"
                d="M8.625 2.0625C5.00063 2.0625 2.0625 5.00063 2.0625 8.625C2.0625 12.2494 5.00063 15.1875 8.625 15.1875C12.2494 15.1875 15.1875 12.2494 15.1875 8.625C15.1875 5.00063 12.2494 2.0625 8.625 2.0625ZM0.9375 8.625C0.9375 4.37931 4.37931 0.9375 8.625 0.9375C12.8707 0.9375 16.3125 4.37931 16.3125 8.625C16.3125 10.5454 15.6083 12.3013 14.4441 13.6487L16.8977 16.1023C17.1174 16.3219 17.1174 16.6781 16.8977 16.8977C16.6781 17.1174 16.3219 17.1174 16.1023 16.8977L13.6487 14.4441C12.3013 15.6083 10.5454 16.3125 8.625 16.3125C4.37931 16.3125 0.9375 12.8707 0.9375 8.625Z"
                fill="currentColor" />
            </g>
            <defs><clipPath id="clip0_gs"><rect width="18" height="18" fill="white" /></clipPath></defs>
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search"
            className="flex-1 bg-transparent text-base text-dark outline-none placeholder:text-dark-4 dark:text-white dark:placeholder:text-dark-6"
          />
          {loading && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          )}
          {query && !loading && (
            <button
              onClick={() => { setQuery(""); setResults(null); }}
              className="text-dark-4 transition hover:text-dark dark:text-dark-6 dark:hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        {/* Result count */}
        {results !== null && results.length > 0 && (
          <div className="flex justify-end border-b border-stroke px-5 py-1.5 dark:border-dark-3">
            <span className="text-xs text-dark-4 dark:text-dark-6">
              {results.length} result{results.length !== 1 ? "s" : ""} found
            </span>
          </div>
        )}

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto">
          {results === null && !loading && (
            <p className="p-8 text-center text-sm text-dark-4 dark:text-dark-6">
              Enter keywords to see the result
            </p>
          )}

          {results !== null && results.length === 0 && !loading && (
            <p className="p-8 text-center text-sm text-dark-4 dark:text-dark-6">
              No messages found for &ldquo;{query}&rdquo;
            </p>
          )}

          {results !== null && results.length > 0 && (
            <ul>
              {results.map((r) => {
                const label = r.senderNickname || r.senderName || "System";
                const initial = label.charAt(0).toUpperCase();
                const imgOk =
                  r.senderImage &&
                  (r.senderImage.startsWith("http") || r.senderImage.startsWith("/"));
                const isPrivate = r.channelType.toLowerCase() === "private";
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => handleResultClick(r)}
                      className="w-full border-b border-stroke px-5 py-4 text-left transition last:border-0 hover:bg-gray-1 dark:border-dark-3 dark:hover:bg-dark-2"
                    >
                      <div className="mb-1.5 flex items-center gap-1.5 text-xs text-dark-4 dark:text-dark-6">
                        <span className="font-medium text-dark dark:text-white">{r.workspaceName}</span>
                        <span>›</span>
                        <span>{isPrivate ? "🔒" : "#"} {r.channelName}</span>
                        <span className="ml-auto shrink-0">{new Date(r.postedAt).toLocaleString()}</span>
                      </div>
                      <div className="flex items-start gap-3">
                        {imgOk ? (
                          <Image src={r.senderImage!} alt={label} width={32} height={32}
                            className="mt-0.5 h-8 w-8 shrink-0 rounded-full object-cover" />
                        ) : (
                          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-700 dark:bg-gray-700 dark:text-white">
                            {initial}
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-dark dark:text-white">{label}</p>
                          <p className="mt-0.5 line-clamp-2 text-sm text-dark-4 dark:text-dark-6">{r.body}</p>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default GlobalSearchModal;
