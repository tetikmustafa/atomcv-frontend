'use client';

/**
 * The template registry, and the appearance sets a profile has saved.
 *
 * Its own file rather than another section of `useProfile`, and the reason is
 * the cache rather than the length: neither of these lives under the
 * profile's key, so neither is touched by `invalidateWholeProfile`. Keeping
 * them here is what stops somebody reaching for that call and quietly
 * refetching a registry that cannot have changed.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { appearanceKeys } from '@/lib/api/queryKeys';
import {
  createCustomization,
  deleteCustomization,
  listCustomizations,
  listTemplates,
  patchCustomization,
  type CustomizationCreate,
  type CustomizationPatch,
} from '@/lib/api/endpoints/profile';

/**
 * What each template holds (§ 33.5).
 *
 * **`staleTime: Infinity`**, because this is the registry's own list: it is
 * the same for everybody and changes when the product ships a new template,
 * not while somebody has the settings screen open. Refetching it on focus
 * would be a request that can only ever return what it returned before.
 *
 * Not gated on anything. Which of these a caller may **pick** is
 * `capabilities.allowedTemplates`; what they **are** is public, and a chooser
 * that hid the density of a template somebody cannot pick would be hiding the
 * reason they cannot.
 */
export function useTemplates() {
  return useQuery({
    queryKey: appearanceKeys.templates(),
    queryFn: () => listTemplates(),
    staleTime: Infinity,
  });
}

/** The sets this profile has kept, oldest first — the order they were made. */
export function useCustomizations(enabled = true) {
  return useQuery({
    queryKey: appearanceKeys.customizations(),
    queryFn: () => listCustomizations(),
    enabled,
  });
}

/**
 * Keeping a set under a name.
 *
 * Invalidated rather than appended: the list is the server's order and the
 * response is one row, so pushing it on the end would be this file deciding a
 * position the server owns. It is a short list read once.
 */
export function useCreateCustomization() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (body: CustomizationCreate) => createCustomization(body),
    onSuccess: () => client.invalidateQueries({ queryKey: appearanceKeys.customizations() }),
  });
}

export function usePatchCustomization() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: CustomizationPatch }) =>
      patchCustomization(id, body),
    onSuccess: () => client.invalidateQueries({ queryKey: appearanceKeys.customizations() }),
  });
}

/**
 * Deleting one.
 *
 * **Nothing else is invalidated, and no resume is at risk.** A generation
 * made with this set holds the settings themselves in its snapshot rather
 * than an id, so it still re-renders exactly as it was sent — which is why
 * this needs no warning about old documents and no cascade.
 */
export function useDeleteCustomization() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteCustomization(id),
    onSuccess: () => client.invalidateQueries({ queryKey: appearanceKeys.customizations() }),
  });
}
