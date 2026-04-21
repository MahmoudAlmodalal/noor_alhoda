"use client";

import { useCallback, useEffect, useState } from "react";

import { onChange } from "@/lib/db/events";
import {
  getStudent,
  listStudents,
  type StudentRecord,
} from "@/lib/data/students";

export interface UseStudentsParams {
  teacher_id?: string;
  search?: string;
}

export interface UseStudentsResult {
  data: StudentRecord[] | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useStudents(params?: UseStudentsParams): UseStudentsResult {
  const [data, setData] = useState<StudentRecord[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Memoise params so the effect doesn't re-subscribe on every parent render.
  const teacherId = params?.teacher_id;
  const search = params?.search;

  const refetch = useCallback(async () => {
    setError(null);
    try {
      const rows = await listStudents({ teacher_id: teacherId, search });
      setData(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [teacherId, search]);

  useEffect(() => {
    void refetch();
    const unsub = onChange("student", () => {
      void refetch();
    });
    return unsub;
  }, [refetch]);

  return { data, isLoading, error, refetch };
}

export interface UseStudentResult {
  data: StudentRecord | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useStudent(id: string | null | undefined): UseStudentResult {
  const [data, setData] = useState<StudentRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!id) {
      setData(null);
      setIsLoading(false);
      return;
    }
    setError(null);
    try {
      const row = await getStudent(id);
      setData(row ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void refetch();
    const unsub = onChange("student", () => {
      void refetch();
    });
    return unsub;
  }, [refetch]);

  return { data, isLoading, error, refetch };
}
