"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/Input";
import { useQuery } from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
import type { StudentWithTeacher } from "@/hooks/queries";

interface Props {
  selectedId: string;
  selectedName: string;
  onSelect: (id: string, name: string) => void;
  enabled?: boolean;
  teacherId?: string;
  placeholder?: string;
}

export function StudentPicker({
  selectedId,
  selectedName,
  onSelect,
  enabled = true,
  teacherId,
  placeholder = "ابحث عن طالب...",
}: Props) {
  const [search, setSearch] = useState(selectedName ?? "");
  const debouncedSearch = useDebounce(search);

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (debouncedSearch) p.search = debouncedSearch;
    if (teacherId) p.teacher_id = teacherId;
    return Object.keys(p).length ? p : undefined;
  }, [debouncedSearch, teacherId]);

  const { data: students } = useQuery<StudentWithTeacher[]>(
    enabled ? "students_with_teacher" : null,
    params
  );

  const filteredStudents = useMemo(
    () => (students ?? []).slice(0, 10),
    [students]
  );

  return (
    <div className="space-y-1.5">
      <Input
        placeholder={placeholder}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="ابحث عن طالب"
        className="h-12 rounded-xl border-border-subtle"
      />
      {filteredStudents.length > 0 && !selectedId && (
        <div className="max-h-40 overflow-y-auto rounded-xl border border-border-card bg-surface-subtle/50">
          {filteredStudents.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onSelect(s.id, s.full_name);
                setSearch(s.full_name);
              }}
              className="w-full text-start px-3 py-2 text-sm hover:bg-white border-b border-border-card last:border-b-0"
            >
              {s.full_name}
            </button>
          ))}
        </div>
      )}
      {selectedId && (
        <p className="text-xs text-primary font-bold mt-1">
          تم اختيار: {selectedName}
        </p>
      )}
    </div>
  );
}
