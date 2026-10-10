import { useEffect, useRef, useState, useCallback, useId } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchSuggestions, clearSuggestions } from "../../store/catalogSlice";
import { formatINR } from "../../lib/format";

const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;

/**
 * Search input with debounced autocomplete dropdown (ARIA 1.2 combobox pattern).
 * Keyboard: ArrowDown/ArrowUp navigate, Enter selects (or submits raw query when
 * no option is active), Escape closes, Tab closes and moves on naturally.
 */
export function SearchAutocomplete({
  id,
  value,
  onChange,
  onSubmit,
  placeholder = "Search products…",
  inputClassName = "",
  ariaLabel = "Search products",
}) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const listId = useId();
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const { items, status } = useSelector((s) => s.catalog.suggestions);

  // Debounced fetch.
  useEffect(() => {
    const q = value.trim();
    if (q.length < MIN_CHARS) {
      dispatch(clearSuggestions());
      setOpen(false);
      setActiveIndex(-1);
      return undefined;
    }
    const timer = setTimeout(() => {
      dispatch(fetchSuggestions(q));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, dispatch]);

  // Open dropdown when suggestions arrive for current input.
  useEffect(() => {
    if (
      status === "succeeded" &&
      items.length > 0 &&
      value.trim().length >= MIN_CHARS
    ) {
      setOpen(true);
    } else if (status === "succeeded" && items.length === 0) {
      setOpen(false);
      setActiveIndex(-1);
    }
  }, [status, items, value]);

  // Close on outside click / focus out.
  useEffect(() => {
    function handlePointerDown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const visible = open && value.trim().length >= MIN_CHARS;

  const selectSuggestion = useCallback(
    (item) => {
      setOpen(false);
      setActiveIndex(-1);
      dispatch(clearSuggestions());
      onChange(item.title);
      navigate(`/product/${item.id}`);
    },
    [dispatch, navigate, onChange]
  );

  function handleKeyDown(event) {
    if (!visible || items.length === 0) {
      if (event.key === "Escape") {
        setOpen(false);
        setActiveIndex(-1);
      }
      return;
    }
    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();
        setActiveIndex((prev) => (prev + 1) % items.length);
        break;
      }
      case "ArrowUp": {
        event.preventDefault();
        setActiveIndex((prev) => (prev <= 0 ? items.length - 1 : prev - 1));
        break;
      }
      case "Enter": {
        if (activeIndex >= 0 && items[activeIndex]) {
          event.preventDefault();
          selectSuggestion(items[activeIndex]);
        } else {
          setOpen(false);
          setActiveIndex(-1);
          dispatch(clearSuggestions());
          onSubmit(event);
        }
        break;
      }
      case "Escape": {
        event.preventDefault();
        setOpen(false);
        setActiveIndex(-1);
        break;
      }
      case "Tab": {
        setOpen(false);
        setActiveIndex(-1);
        break;
      }
      default:
        break;
    }
  }

  function handleChange(event) {
    const next = event.target.value;
    onChange(next);
    setActiveIndex(-1);
    if (next.trim().length < MIN_CHARS) {
      setOpen(false);
      dispatch(clearSuggestions());
    }
  }

  const activeOptionId =
    activeIndex >= 0 && items[activeIndex] ? `${listId}-opt-${activeIndex}` : undefined;

  return (
    <div ref={containerRef} className="relative w-full">
      <label htmlFor={id} className="sr-only">
        {ariaLabel}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="search"
          role="combobox"
          aria-expanded={visible}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeOptionId}
          aria-label={ariaLabel}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (items.length > 0 && value.trim().length >= MIN_CHARS) setOpen(true);
          }}
          placeholder={placeholder}
          maxLength={200}
          autoComplete="off"
          className={`h-11 w-full rounded-lg border border-neutral-300 bg-white pl-10 pr-3 text-body-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 ${inputClassName}`}
        />
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"
          />
        </svg>
        {status === "loading" && (
          <span
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-neutral-200 border-t-primary-500"
            aria-hidden="true"
          />
        )}
      </div>

      {visible && items.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Search suggestions"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-xl border border-neutral-200 bg-white py-1 shadow-lg shadow-neutral-900/10"
        >
          {items.map((item, index) => (
            <li
              key={item.id}
              id={`${listId}-opt-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseEnter={() => setActiveIndex(index)}
              onPointerDown={(event) => {
                event.preventDefault();
                selectSuggestion(item);
              }}
              className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 ${
                index === activeIndex ? "bg-primary-50" : "bg-white"
              }`}
            >
              {item.image ? (
                <img
                  src={item.image}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-md border border-neutral-100 object-cover"
                  loading="lazy"
                />
              ) : (
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-400"
                  aria-hidden="true"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                  </svg>
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body-sm font-medium text-neutral-900">
                  {item.title}
                </span>
                {item.brand && (
                  <span className="block truncate text-caption text-neutral-500">{item.brand}</span>
                )}
              </span>
              {item.bestPrice != null && (
                <span className="shrink-0 text-body-sm font-semibold text-neutral-900">
                  {formatINR(item.bestPrice)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
