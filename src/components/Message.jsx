import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

function formatMarkdown(text = "") {
    return text
        .replace(/\\([#*_|])/g, "$1")
        .replace(/\\\[([\\s\\S]*?)\\\]/g, (_, math) => `\n$$\n${math}\n$$\n`)
        .replace(/\\\(([\\s\\S]*?)\\\)/g, (_, math) => `$${math}$`)
        .replace(/\\([`~])/g, "$1");
}

function CopyButton({ text, className = "" }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [text]);

    return (
        <button
            type="button"
            className={`copy-btn ${className}`}
            onClick={handleCopy}
            title={copied ? "Copied!" : "Copy"}
            aria-label={copied ? "Copied" : "Copy to clipboard"}
        >
            {copied ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" />
                </svg>
            ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
            )}
        </button>
    );
}

function CodeBlock({ className, children }) {
    const match = /language-(\w+)/.exec(className || "");
    const lang = match ? match[1] : "";
    const code = String(children).replace(/\n$/, "");

    return (
        <div className="code-block-wrapper">
            <div className="code-block-header">
                <span className="code-block-lang">{lang || "code"}</span>
                <CopyButton text={code} className="code-copy-btn" />
            </div>
            <pre className="code-block-pre">
                <code className={className}>{children}</code>
            </pre>
        </div>
    );
}

function Message({ id, role, content, onTextSelect }) {
    const [hovering, setHovering] = useState(false);
    const [copiedMsg, setCopiedMsg] = useState(false);

    const handleMouseUp = () => {
        if (role !== "assistant") return;

        const selection = window.getSelection();
        const selectedText = selection?.toString().trim();

        if (!selectedText || !selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        onTextSelect({
            text: selectedText,
            sourceMessage: content,
            sourceMessageId: id,
            position: {
                top: rect.top,
                left: rect.left,
                bottom: rect.bottom,
                right: rect.right
            }
        });
    };

    const handleCopyMessage = () => {
        navigator.clipboard.writeText(content).then(() => {
            setCopiedMsg(true);
            setTimeout(() => setCopiedMsg(false), 2000);
        });
    };

    if (role === "user") {
        return (
            <div className="message-row user-row" id={id ? `msg-${id}` : undefined}>
                <div className="user-bubble">
                    {content}
                </div>
            </div>
        );
    }

    return (
        <div
            className="message-row assistant-row"
            id={id ? `msg-${id}` : undefined}
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
        >
            <div className="assistant-avatar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 3.5 14.4 9.6 20.5 12l-6.1 2.4L12 20.5l-2.4-6.1L3.5 12l6.1-2.4L12 3.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
            </div>

            <div className="assistant-content" onMouseUp={handleMouseUp}>
                <div className="markdown-content">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={{
                            a: ({ node: _node, ...props }) => (
                                <a {...props} target="_blank" rel="noopener noreferrer" />
                            ),
                            table: ({ node: _node, ...props }) => (
                                <div className="markdown-table-wrapper">
                                    <table {...props} />
                                </div>
                            ),
                            pre: ({ children }) => <>{children}</>,
                            code: ({ node: _node, className, children, ...props }) => {
                                const isInline = !className && typeof children === "string" && !children.includes("\n");
                                if (isInline) {
                                    return <code className="inline-code" {...props}>{children}</code>;
                                }
                                return <CodeBlock className={className}>{children}</CodeBlock>;
                            }
                        }}
                    >
                        {formatMarkdown(content)}
                    </ReactMarkdown>
                </div>

                <div className={`message-actions ${hovering ? "visible" : ""}`}>
                    <button
                        type="button"
                        className="action-btn"
                        onClick={handleCopyMessage}
                        title={copiedMsg ? "Copied!" : "Copy"}
                    >
                        {copiedMsg ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                        ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                        )}
                    </button>
                    <button type="button" className="action-btn" title="Good response">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 10v12" /><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" /></svg>
                    </button>
                    <button type="button" className="action-btn" title="Bad response">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 14V2" /><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z" /></svg>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Message;
