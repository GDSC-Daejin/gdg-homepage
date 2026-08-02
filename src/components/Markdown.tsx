import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { cn } from "@/lib/cn";

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("text-sm leading-relaxed text-gray-700", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          h1: (p) => <h1 className="mb-2 mt-4 text-lg font-bold text-gray-900" {...p} />,
          h2: (p) => <h2 className="mb-2 mt-4 text-base font-bold text-gray-900" {...p} />,
          h3: (p) => <h3 className="mb-1 mt-3 text-sm font-bold text-gray-900" {...p} />,
          p: (p) => <p className="my-2 first:mt-0 last:mb-0" {...p} />,
          ul: (p) => <ul className="my-2 list-disc pl-5" {...p} />,
          ol: (p) => <ol className="my-2 list-decimal pl-5" {...p} />,
          li: (p) => <li className="my-0.5" {...p} />,
          a: (p) => (
            <a className="text-primary underline" target="_blank" rel="noreferrer" {...p} />
          ),
          code: ({ className: c, children, ...rest }) => {
            const fenced = /language-(\w+)/.test(c ?? "");
            return fenced ? (
              <code className={c} {...rest}>
                {children}
              </code>
            ) : (
              <code
                className="rounded bg-gray-100 px-1 py-0.5 text-[0.85em] text-gray-800"
                {...rest}
              >
                {children}
              </code>
            );
          },
          pre: (p) => (
            <pre
              className="my-2 overflow-x-auto rounded-md bg-gray-900 p-3 text-xs text-gray-100"
              {...p}
            />
          ),
          blockquote: (p) => (
            <blockquote className="my-2 border-l-4 border-gray-200 pl-3 text-gray-500" {...p} />
          ),
          table: (p) => (
            <div className="my-2 overflow-x-auto">
              <table className="w-full border-collapse text-xs" {...p} />
            </div>
          ),
          th: (p) => (
            <th className="border border-gray-200 px-2 py-1 text-left font-semibold" {...p} />
          ),
          td: (p) => <td className="border border-gray-200 px-2 py-1" {...p} />,
          hr: () => <hr className="my-4 border-gray-200" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
