import { useState, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { formatMarkdown } from "../utils/markdown.js";

function CopyButton({ text, className = "" }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(() => {
        navigator.clipboard
            .writeText(text)
            .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            })
            .catch(() => { });
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
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="M20 6 9 17l-5-5" />
                </svg>
            ) : (
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
            )}
        </button>
    );
}

function renderWithBreaks(child) {
    if (typeof child === "string" && /<br\s*\/?>/i.test(child)) {
        const parts = child.split(/<br\s*\/?>/i);
        return parts.map((part, i) => (
            <span key={i}>
                {i > 0 && <br />}
                {part}
            </span>
        ));
    }
    if (Array.isArray(child)) {
        return child.map((item, idx) => (
            <span key={idx}>{renderWithBreaks(item)}</span>
        ));
    }
    return child;
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

function Message({ id, role, content = "", onTextSelect }) {
    const [hovering, setHovering] = useState(false);
    const [copiedMsg, setCopiedMsg] = useState(false);

    const formattedContent = useMemo(() => formatMarkdown(content), [content]);

    const handleMouseUp = () => {
        if (role !== "assistant" || !onTextSelect) return;

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
                right: rect.right,
            },
        });
    };

    const handleCopyMessage = () => {
        navigator.clipboard
            .writeText(content)
            .then(() => {
                setCopiedMsg(true);
                setTimeout(() => setCopiedMsg(false), 2000);
            })
            .catch(() => { });
    };

    if (role === "user") {
        return (
            <div className="message-row user-row" id={id ? `msg-${id}` : undefined}>
                <div className="user-bubble">{content}</div>
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
                    <path
                        d="M12 3.5 14.4 9.6 20.5 12l-6.1 2.4L12 20.5l-2.4-6.1L3.5 12l6.1-2.4L12 3.5Z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                    />
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
                            td: ({ node: _node, children, ...props }) => (
                                <td {...props}>{renderWithBreaks(children)}</td>
                            ),
                            th: ({ node: _node, children, ...props }) => (
                                <th {...props}>{renderWithBreaks(children)}</th>
                            ),
                            p: ({ node: _node, children, ...props }) => (
                                <p {...props}>{renderWithBreaks(children)}</p>
                            ),
                            pre: ({ children }) => <>{children}</>,
                            code: ({ node: _node, className, children, ...props }) => {
                                const isInline =
                                    !className &&
                                    typeof children === "string" &&
                                    !children.includes("\n");

                                if (isInline) {
                                    return (
                                        <code className="inline-code" {...props}>
                                            {children}
                                        </code>
                                    );
                                }

                                return (
                                    <CodeBlock className={className}>
                                        {children}
                                    </CodeBlock>
                                );
                            },
                        }}
                    >
                        {formattedContent}
                    </ReactMarkdown>
                </div>

                {/* Message Action Toolbar (shows on hover or when copied) */}
                {(hovering || copiedMsg) && (
                    <div className="message-actions">
                        <button
                            type="button"
                            className="copy-msg-btn"
                            onClick={handleCopyMessage}
                            aria-label="Copy entire message"
                        >
                            {copiedMsg ? "Copied!" : "Copy"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Message;