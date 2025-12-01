import Image from '@tiptap/extension-image';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ResizableImage } from './ResizableImage';

export interface ImageUploadOptions {
  onUpload: (file: File) => Promise<string | null>;
  onError?: (error: Error) => void;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imageUpload: {
      uploadImage: (file: File) => ReturnType;
    };
  }
}

/**
 * Extended Image extension with paste/drop upload support and inline resizing
 */
export const ImageUploadExtension = Image.extend<ImageUploadOptions>({
  name: 'image',

  addOptions() {
    return {
      ...this.parent?.(),
      inline: false,
      allowBase64: false,
      HTMLAttributes: {
        class: 'tiptap-image',
      },
      onUpload: async () => null,
      onError: () => {},
    };
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          const width = element.getAttribute('width');
          return width ? parseInt(width, 10) : null;
        },
        renderHTML: (attributes) => {
          if (!attributes.width) {
            return {};
          }
          return { width: attributes.width };
        },
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImage);
  },

  addCommands() {
    return {
      ...this.parent?.(),
      uploadImage:
        (file: File) =>
        ({ commands }) => {
          const { onUpload, onError } = this.options;

          // Upload the file
          onUpload(file)
            .then((url) => {
              if (url) {
                commands.setImage({ src: url });
              }
            })
            .catch((error) => {
              onError?.(error);
            });

          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const { onUpload, onError } = this.options;

    return [
      new Plugin({
        key: new PluginKey('imageUploadHandler'),
        props: {
          // Handle paste events
          handlePaste: (view, event) => {
            const items = event.clipboardData?.items;
            if (!items) return false;

            for (const item of items) {
              if (item.type.startsWith('image/')) {
                event.preventDefault();
                const file = item.getAsFile();
                if (file) {
                  onUpload(file)
                    .then((url) => {
                      if (url) {
                        const { tr, schema } = view.state;
                        const imageNode = schema.nodes.image.create({ src: url });
                        const transaction = tr.replaceSelectionWith(imageNode);
                        view.dispatch(transaction);
                      }
                    })
                    .catch((error) => {
                      onError?.(error);
                    });
                }
                return true;
              }
            }
            return false;
          },

          // Handle drop events
          handleDrop: (view, event, _slice, moved) => {
            // Don't handle if this is a move within the editor
            if (moved) return false;

            const files = event.dataTransfer?.files;
            if (!files || files.length === 0) return false;

            // Find the first image file
            let imageFile: File | null = null;
            for (const file of files) {
              if (file.type.startsWith('image/')) {
                imageFile = file;
                break;
              }
            }

            if (!imageFile) return false;

            event.preventDefault();

            // Get drop position
            const coordinates = view.posAtCoords({
              left: event.clientX,
              top: event.clientY,
            });

            if (!coordinates) return false;

            onUpload(imageFile)
              .then((url) => {
                if (url) {
                  const { tr, schema } = view.state;
                  const imageNode = schema.nodes.image.create({ src: url });
                  const transaction = tr.insert(coordinates.pos, imageNode);
                  view.dispatch(transaction);
                }
              })
              .catch((error) => {
                onError?.(error);
              });

            return true;
          },
        },
      }),
    ];
  },
});
