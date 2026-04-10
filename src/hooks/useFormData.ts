import { useState, useCallback } from 'react';
import { FormData, Titulo, Idioma, Produccion, Experiencia } from '../types';
import { getInitialFormData } from '../utils';

/**
 * Hook for managing form state
 */
export const useFormData = (initialData?: Partial<FormData>) => {
  const [formData, setFormData] = useState<FormData>(
    initialData ? { ...getInitialFormData(), ...initialData } : getInitialFormData()
  );

  const updateField = useCallback((field: keyof FormData, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const addTitulo = useCallback((titulo: Titulo) => {
    setFormData((prev) => ({
      ...prev,
      titulos: [...prev.titulos, titulo],
    }));
  }, []);

  const removeTitulo = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      titulos: prev.titulos.filter((_, i) => i !== index),
    }));
  }, []);

  const updateTitulo = useCallback((index: number, titulo: Titulo) => {
    setFormData((prev) => ({
      ...prev,
      titulos: prev.titulos.map((t, idx) => (idx === index ? titulo : t)),
    }));
  }, []);

  const addIdioma = useCallback((idioma: Idioma) => {
    setFormData((prev) => ({
      ...prev,
      idiomas: [...prev.idiomas, idioma],
    }));
  }, []);

  const removeIdioma = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      idiomas: prev.idiomas.filter((_, i) => i !== index),
    }));
  }, []);

  const updateIdioma = useCallback((index: number, idioma: Idioma) => {
    setFormData((prev) => ({
      ...prev,
      idiomas: prev.idiomas.map((i, idx) => (idx === index ? idioma : i)),
    }));
  }, []);

  const addProduccion = useCallback((produccion: Produccion[]) => {
    setFormData((prev) => ({
      ...prev,
      produccion: [...prev.produccion, ...produccion],
    }));
  }, []);

  const removeProduccion = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      produccion: prev.produccion.filter((_, i) => i !== index),
    }));
  }, []);

  const addExperiencia = useCallback((experiencia: Experiencia) => {
    setFormData((prev) => ({
      ...prev,
      experiencia: [...prev.experiencia, experiencia],
    }));
  }, []);

  const removeExperiencia = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      experiencia: prev.experiencia.filter((_, i) => i !== index),
    }));
  }, []);

  const updateExperiencia = useCallback((index: number, experiencia: Experiencia) => {
    setFormData((prev) => ({
      ...prev,
      experiencia: prev.experiencia.map((e, idx) => (idx === index ? experiencia : e)),
    }));
  }, []);

  const reset = useCallback(() => {
    setFormData(getInitialFormData());
  }, []);

  return {
    formData,
    updateField,
    addTitulo,
    removeTitulo,
    updateTitulo,
    addIdioma,
    removeIdioma,
    updateIdioma,
    addProduccion,
    removeProduccion,
    addExperiencia,
    removeExperiencia,
    updateExperiencia,
    reset,
  };
};
