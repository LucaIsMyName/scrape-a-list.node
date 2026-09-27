import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchConfig, fetchPresetConfig } from '@/lib/api';
import { createFieldRow } from '@/lib/fields';
import {
  configToForm,
  emptyForm,
  hasAdvancedValues,
  loadStoredForm,
  saveStoredForm,
} from '@/lib/storage';
import { toScrapeBody, validateForm } from '@/lib/validation';
import type { FieldRow, FormState, LoadedConfig, ScrapeBody } from '@/lib/types';

type ValidateResult = { error: string } | { body: ScrapeBody };

export function useScrapeForm() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formDirty, setFormDirty] = useState(false);
  const [loadedConfig, setLoadedConfig] = useState<LoadedConfig>({ defaults: {}, presets: [] });
  const [configError, setConfigError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef(form);
  formRef.current = form;

  const persist = useCallback((next: FormState) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveStoredForm(next), 400);
  }, []);

  const updateForm = useCallback(
    (patch: Partial<FormState> | ((prev: FormState) => FormState), markDirty = true) => {
      setForm((prev) => {
        const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
        if (markDirty) {
          setFormDirty(true);
          persist(next);
        }
        return next;
      });
    },
    [persist],
  );

  const replaceForm = useCallback(
    (next: FormState, markDirty = false) => {
      setForm(next);
      setFormDirty(markDirty);
      setAdvancedOpen(hasAdvancedValues(next));
      saveStoredForm(next);
    },
    [],
  );

  const updateFieldRow = useCallback(
    (id: string, patch: Partial<FieldRow>) => {
      updateForm((prev) => ({
        ...prev,
        fields: prev.fields.map((row) => (row.id === id ? { ...row, ...patch } : row)),
      }));
    },
    [updateForm],
  );

  const addFieldRow = useCallback(() => {
    updateForm((prev) => ({ ...prev, fields: [...prev.fields, createFieldRow()] }));
  }, [updateForm]);

  const removeFieldRow = useCallback(
    (id: string) => {
      updateForm((prev) => {
        const fields = prev.fields.filter((row) => row.id !== id);
        return { ...prev, fields: fields.length ? fields : [createFieldRow()] };
      });
    },
    [updateForm],
  );

  const applyPreset = useCallback(
    async (presetName: string) => {
      const config = presetName
        ? await fetchPresetConfig(loadedConfig, presetName)
        : { ...(loadedConfig.defaults || {}) };
      replaceForm(configToForm(config, presetName));
      setConfigError(null);
    },
    [loadedConfig, replaceForm],
  );

  const loadDefaults = useCallback(async () => {
    try {
      const config = await fetchConfig();
      setLoadedConfig(config);
      setConfigError(null);
      const stored = loadStoredForm();
      if (stored) {
        replaceForm(stored);
      } else {
        replaceForm(configToForm(config.defaults || {}));
      }
    } catch (error) {
      setConfigError(
        error instanceof Error ? error.message : 'Could not load presets. Check that the server is running.',
      );
    }
  }, [replaceForm]);

  useEffect(() => {
    void loadDefaults();
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [loadDefaults]);

  const validateAndBuild = useCallback((): ValidateResult => {
    const current = formRef.current;
    const error = validateForm(current);
    if (error) return { error };
    return { body: toScrapeBody(current) };
  }, []);

  return {
    form,
    formDirty,
    loadedConfig,
    configError,
    advancedOpen,
    setAdvancedOpen,
    updateForm,
    updateFieldRow,
    addFieldRow,
    removeFieldRow,
    applyPreset,
    validateAndBuild,
  };
}
