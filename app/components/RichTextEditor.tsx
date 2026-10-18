// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Button, cn } from "@cloudflare/kumo";
import {
	ArrowClockwiseIcon,
	ArrowCounterClockwiseIcon,
	LinkSimpleIcon,
	ListBulletsIcon,
	ListNumbersIcon,
	QuotesIcon,
	TextBIcon,
	TextItalicIcon,
	TextStrikethroughIcon,
	TextUnderlineIcon,
} from "@phosphor-icons/react";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TiptapImage from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Placeholder } from "@tiptap/extensions";
import { type Editor, EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect } from "react";

interface UseRichTextEditorOptions {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	/** Minimum height of the writing area, e.g. "min-h-40". */
	minHeightClassName?: string;
	autoFocus?: boolean;
}

/**
 * The editor instance is owned by the host so the writing area and the
 * formatting bar can live in different parts of the layout.
 */
export function useRichTextEditor({
	value,
	onChange,
	placeholder = "Write your message…",
	minHeightClassName = "min-h-40",
	autoFocus = true,
}: UseRichTextEditorOptions) {
	const editor = useEditor({
		immediatelyRender: false,
		extensions: [
			StarterKit.configure({ link: { openOnClick: false, autolink: true } }),
			TextAlign.configure({ types: ["heading", "paragraph"] }),
			TiptapImage,
			TextStyle,
			Color,
			Highlight.configure({ multicolor: true }),
			Placeholder.configure({ placeholder }),
		],
		content: value,
		autofocus: autoFocus ? "start" : false,
		editorProps: {
			attributes: {
				class: cn("text-[14px] text-kumo-default focus:outline-none", minHeightClassName),
			},
		},
		onUpdate: ({ editor: e }) => {
			onChange(e.getHTML());
		},
	});

	// Sync external value changes (e.g. switching reply targets or loading a draft).
	useEffect(() => {
		if (editor && !editor.isDestroyed && value !== editor.getHTML()) {
			editor.commands.setContent(value);
			if (!autoFocus) return;
			// Place the cursor at the top, above any quoted text.
			const rafId = requestAnimationFrame(() => {
				if (!editor.isDestroyed) editor.commands.focus("start");
			});
			return () => cancelAnimationFrame(rafId);
		}
	}, [value, editor, autoFocus]);

	return editor;
}

export function RichTextContent({
	editor,
	className,
	minHeightClassName = "min-h-40",
}: {
	editor: Editor | null;
	className?: string;
	minHeightClassName?: string;
}) {
	if (!editor) return <div className={cn(minHeightClassName, className)} />;
	return (
		<div
			className={cn("cursor-text", className)}
			onClick={(e) => {
				if (e.target === e.currentTarget) editor.commands.focus("end");
			}}
		>
			<EditorContent editor={editor} />
		</div>
	);
}

function ToolButton({
	label,
	active,
	disabled,
	onClick,
	children,
}: {
	label: string;
	active?: boolean;
	disabled?: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<Button
			variant="ghost"
			shape="square"
			size="sm"
			title={label}
			aria-pressed={active}
			disabled={disabled}
			icon={children}
			// Keep the editor selection while clicking toolbar buttons.
			onMouseDown={(e) => e.preventDefault()}
			onClick={onClick}
			className={cn(
				"size-7 text-kumo-subtle hover:text-kumo-default",
				active && "bg-kumo-fill text-kumo-default",
			)}
		/>
	);
}

function ToolbarButtons({ editor }: { editor: Editor }) {
	const state = useEditorState({
		editor,
		selector: ({ editor: e }) => ({
			bold: e.isActive("bold"),
			italic: e.isActive("italic"),
			underline: e.isActive("underline"),
			strike: e.isActive("strike"),
			bulletList: e.isActive("bulletList"),
			orderedList: e.isActive("orderedList"),
			blockquote: e.isActive("blockquote"),
			link: e.isActive("link"),
			canUndo: e.can().undo(),
			canRedo: e.can().redo(),
		}),
	});

	const setLink = useCallback(() => {
		const previousUrl = editor.getAttributes("link").href;
		const url = window.prompt("Link URL", previousUrl);
		if (url === null) return;
		if (url === "") {
			editor.chain().focus().extendMarkRange("link").unsetLink().run();
			return;
		}
		editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
	}, [editor]);

	const divider = <span className="mx-1 h-4 w-px shrink-0 bg-kumo-line" aria-hidden="true" />;

	return (
		<div className="flex items-center gap-px" role="toolbar" aria-label="Formatting">
			<ToolButton label="Bold (⌘B)" active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
				<TextBIcon size={15} weight="bold" />
			</ToolButton>
			<ToolButton label="Italic (⌘I)" active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
				<TextItalicIcon size={15} />
			</ToolButton>
			<ToolButton label="Underline (⌘U)" active={state.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}>
				<TextUnderlineIcon size={15} />
			</ToolButton>
			<ToolButton label="Strikethrough" active={state.strike} onClick={() => editor.chain().focus().toggleStrike().run()}>
				<TextStrikethroughIcon size={15} />
			</ToolButton>
			{divider}
			<ToolButton label="Bulleted list" active={state.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()}>
				<ListBulletsIcon size={15} />
			</ToolButton>
			<ToolButton label="Numbered list" active={state.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
				<ListNumbersIcon size={15} />
			</ToolButton>
			<ToolButton label="Quote" active={state.blockquote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
				<QuotesIcon size={15} />
			</ToolButton>
			<ToolButton label="Link" active={state.link} onClick={setLink}>
				<LinkSimpleIcon size={15} />
			</ToolButton>
			{divider}
			<ToolButton label="Undo (⌘Z)" disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()}>
				<ArrowCounterClockwiseIcon size={15} />
			</ToolButton>
			<ToolButton label="Redo (⇧⌘Z)" disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()}>
				<ArrowClockwiseIcon size={15} />
			</ToolButton>
		</div>
	);
}

export function RichTextToolbar({ editor }: { editor: Editor | null }) {
	if (!editor) return null;
	return <ToolbarButtons editor={editor} />;
}
