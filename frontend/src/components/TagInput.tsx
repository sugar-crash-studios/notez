import { useState, useEffect, useRef } from 'react';
import { X, Plus } from 'lucide-react';
import { tagsApi } from '../lib/api';

interface Tag {
  id: string;
  name: string;
}

interface TagInputProps {
  tags: Tag[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}

export function TagInput({ tags, onChange, disabled = false }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Load suggestions when input changes
  useEffect(() => {
    const loadSuggestions = async () => {
      if (inputValue.trim().length === 0) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      try {
        const response = await tagsApi.search(inputValue, 10);
        const allTags = response.data.tags;

        // Filter out tags that are already added
        const existingTagNames = tags.map((t) => t.name.toLowerCase());
        const filteredTags = allTags.filter(
          (t: Tag) => !existingTagNames.includes(t.name.toLowerCase())
        );

        setSuggestions(filteredTags);
        setShowSuggestions(filteredTags.length > 0);
        setSelectedIndex(-1);
      } catch (error) {
        console.error('Failed to load tag suggestions:', error);
      }
    };

    const debounceTimeout = setTimeout(loadSuggestions, 200);
    return () => clearTimeout(debounceTimeout);
  }, [inputValue, tags]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addTag = (tagName: string) => {
    const trimmedName = tagName.trim();
    if (trimmedName.length === 0) return;

    // Check if tag already exists (case-insensitive)
    const existingTagNames = tags.map((t) => t.name.toLowerCase());
    if (existingTagNames.includes(trimmedName.toLowerCase())) {
      return;
    }

    // Add new tag
    const newTags = [...tags.map((t) => t.name), trimmedName];
    onChange(newTags);
    setInputValue('');
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  const removeTag = (tagName: string) => {
    const newTags = tags.filter((t) => t.name !== tagName).map((t) => t.name);
    onChange(newTags);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();

      if (showSuggestions && selectedIndex >= 0 && selectedIndex < suggestions.length) {
        // Select highlighted suggestion
        addTag(suggestions[selectedIndex].name);
      } else if (inputValue.trim().length > 0) {
        // Add new tag from input
        addTag(inputValue);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (showSuggestions && suggestions.length > 0) {
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (showSuggestions && suggestions.length > 0) {
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
      }
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      // Remove last tag when backspace on empty input
      removeTag(tags[tags.length - 1].name);
    }
  };

  return (
    <div className="relative">
      {/* Tag Pills and Input */}
      <div className="flex flex-wrap items-center gap-2 p-2 border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 bg-white">
        {tags.map((tag) => (
          <div
            key={tag.id || tag.name}
            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-md"
          >
            <span>{tag.name}</span>
            {!disabled && (
              <button
                type="button"
                onClick={() => removeTag(tag.name)}
                className="hover:bg-blue-200 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}

        {!disabled && (
          <div className="flex-1 min-w-[120px]">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => inputValue.trim().length > 0 && setShowSuggestions(true)}
              placeholder={tags.length === 0 ? 'Add tags...' : ''}
              className="w-full outline-none text-sm"
            />
          </div>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto"
        >
          {suggestions.map((tag, index) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => addTag(tag.name)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${
                index === selectedIndex ? 'bg-blue-50' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <Plus className="w-3 h-3 text-gray-400" />
                <span>{tag.name}</span>
              </div>
            </button>
          ))}

          {/* Option to create new tag if input doesn't match any suggestion */}
          {inputValue.trim().length > 0 &&
            !suggestions.some((s) => s.name.toLowerCase() === inputValue.trim().toLowerCase()) && (
              <button
                type="button"
                onClick={() => addTag(inputValue)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 border-t border-gray-200 ${
                  selectedIndex === suggestions.length ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <Plus className="w-3 h-3 text-green-500" />
                  <span>
                    Create "<span className="font-medium">{inputValue.trim()}</span>"
                  </span>
                </div>
              </button>
            )}
        </div>
      )}
    </div>
  );
}
