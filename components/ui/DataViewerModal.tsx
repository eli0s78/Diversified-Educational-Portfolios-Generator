"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import type { TopicInfo, Paper } from "@/lib/engine/portfolio-types";

interface DataViewerModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
    type: "report" | "topics" | "papers";
    reportContent?: string;
    topics?: TopicInfo[];
    papers?: Paper[];
}

export function DataViewerModal({
    open,
    onClose,
    title,
    type,
    reportContent,
    topics,
    papers,
}: DataViewerModalProps) {
    const closeRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (open) closeRef.current?.focus();
    }, [open]);

    useEffect(() => {
        if (!open) return;
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            {/* Dialog */}
            <div className="relative mx-4 flex w-full max-w-4xl flex-col rounded-xl border border-border bg-card shadow-2xl" style={{ maxHeight: "85vh" }}>
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border px-6 py-4">
                    <h2 className="text-lg font-semibold">{title}</h2>
                    <button
                        onClick={onClose}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {type === "report" && (
                        <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
                            {reportContent || "No content available."}
                        </div>
                    )}

                    {type === "topics" && topics && (
                        <div className="rounded-md border overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 border-b">
                                    <tr>
                                        <th className="h-10 px-4 text-left font-medium">#</th>
                                        <th className="h-10 px-4 text-left font-medium">Name</th>
                                        <th className="h-10 px-4 text-right font-medium">Papers</th>
                                        <th className="h-10 px-4 text-left font-medium">Keywords</th>
                                        <th className="h-10 px-4 text-left font-medium">Rarity</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topics.filter(t => t.topicNumber >= 0).map((topic, i) => (
                                        <tr key={topic.topicNumber} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                                            <td className="p-4 align-top font-medium">{topic.topicNumber}</td>
                                            <td className="p-4 align-top font-semibold text-primary">{topic.name}</td>
                                            <td className="p-4 align-top text-right">{topic.count}</td>
                                            <td className="p-4 align-top text-muted-foreground">{topic.keywords.join(", ")}</td>
                                            <td className="p-4 align-top">
                                                <Badge variant={topic.rarityLabel === "RARE" ? "primary" : "muted"}>
                                                    {topic.rarityLabel}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                    {topics.filter(t => t.topicNumber >= 0).length === 0 && (
                                        <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No topics available.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {type === "papers" && papers && (
                        <div className="rounded-md border overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 border-b sticky top-0 z-10">
                                    <tr>
                                        <th className="h-10 px-4 text-left font-medium w-1/2">Title & Authors</th>
                                        <th className="h-10 px-4 text-left font-medium">Year</th>
                                        <th className="h-10 px-4 text-left font-medium">Venue</th>
                                        <th className="h-10 px-4 text-left font-medium">Topic</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {papers.map((paper, i) => (
                                        <tr key={paper.id} className={cn("border-b border-border/50 transition-colors", i % 2 === 0 ? "bg-background" : "bg-muted/10")}>
                                            <td className="p-4 align-top">
                                                <div className="font-medium text-primary mb-1">
                                                    {paper.url ? (
                                                        <a href={paper.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{paper.title}</a>
                                                    ) : paper.title}
                                                </div>
                                                <div className="text-xs text-muted-foreground">{paper.authors}</div>
                                            </td>
                                            <td className="p-4 align-top">{paper.year}</td>
                                            <td className="p-4 align-top text-muted-foreground truncate max-w-[150px]" title={paper.venue}>{paper.venue || "N/A"}</td>
                                            <td className="p-4 align-top">
                                                {paper.topicNumber >= 0 ? (
                                                    <Badge variant="muted">Topic {paper.topicNumber}</Badge>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">Outlier</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {papers.length === 0 && (
                                        <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No papers available.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end border-t border-border px-6 py-4">
                    <Button ref={closeRef} variant="secondary" onClick={onClose}>
                        Close
                    </Button>
                </div>
            </div>
        </div>
    );
}
