"use client";

import { useEffect } from "react";

/**
 * Disables browser HTML5 validation bubbles ("Please fill out this field")
 * for every form in the app — including ones rendered later in modals.
 */
export function DisableNativeValidation() {
  useEffect(() => {
    const apply = (root: ParentNode = document) => {
      root.querySelectorAll("form").forEach((form) => {
        if (!form.hasAttribute("novalidate")) {
          form.setAttribute("novalidate", "");
        }
      });
    };

    apply();
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.tagName === "FORM") {
            node.setAttribute("novalidate", "");
          } else {
            apply(node);
          }
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
