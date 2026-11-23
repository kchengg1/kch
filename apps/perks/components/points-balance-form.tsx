"use client";

import { useMemo, useState } from "react";
import { Input } from "@kch/ui";
import { ActionForm } from "@/components/action-form";
import { formatCents } from "@/lib/money";
import {
  DEFAULT_CENTS_PER_POINT,
  PROGRAMS,
  VALUATION_SOURCE,
  balanceValueCents,
  defaultCentsPerPoint,
  formatCpp,
  normalizeProgram,
} from "@/lib/points";

type FormState = { error?: string; message?: string } | undefined;

export function PointsBalanceForm({
  action,
  existing,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  existing: { program: string; centsPerPoint: number; customValue: boolean }[];
}) {
  const [program, setProgram] = useState("");
  const [balance, setBalance] = useState("");
  const [cpp, setCpp] = useState("");
  const [cppEdited, setCppEdited] = useState(false);

  const existingMap = useMemo(() => new Map(existing.map((e) => [e.program, e])), [existing]);

  const normalized = program.trim() ? normalizeProgram(program) : "";
  const isKnownProgram = Boolean(normalized && normalized in DEFAULT_CENTS_PER_POINT);
  const autoCpp = normalized ? defaultCentsPerPoint(normalized) : null;

  function handleProgramChange(next: string) {
    setProgram(next);
    const trimmed = next.trim();
    if (!trimmed) {
      if (!cppEdited) setCpp("");
      return;
    }
    const norm = normalizeProgram(trimmed);
    const saved = existingMap.get(norm);
    const known = norm in DEFAULT_CENTS_PER_POINT;
    if (!cppEdited) {
      if (saved) {
        setCpp(String(saved.centsPerPoint));
      } else if (known) {
        setCpp(String(defaultCentsPerPoint(norm)));
      }
    }
  }

  function handleCppChange(next: string) {
    setCpp(next);
    const trimmed = next.trim();
    if (!trimmed) {
      setCppEdited(false);
      return;
    }
    const n = Number(trimmed.replace(/[¢\s]/g, ""));
    if (
      autoCpp !== null &&
      Number.isFinite(n) &&
      Math.round(n * 100) === Math.round(autoCpp * 100)
    ) {
      setCppEdited(false);
    } else {
      setCppEdited(true);
    }
  }

  const parsedBalance = Math.round(Number(balance.replace(/[,\s]/g, "")));
  const parsedCpp = cpp.trim() ? Number(cpp.replace(/[¢\s]/g, "")) : autoCpp;
  const previewValueCents =
    Number.isFinite(parsedBalance) &&
    parsedBalance > 0 &&
    parsedCpp !== null &&
    Number.isFinite(parsedCpp) &&
    parsedCpp >= 0
      ? Math.round(balanceValueCents(parsedBalance, Math.round(parsedCpp * 100)) / 100) * 100
      : null;

  const isCustomInput =
    autoCpp !== null &&
    cpp.trim() !== "" &&
    Number.isFinite(Number(cpp.replace(/[¢\s]/g, ""))) &&
    Math.round(Number(cpp.replace(/[¢\s]/g, "")) * 100) !== Math.round(autoCpp * 100);

  return (
    <ActionForm action={action} submit="Save balance" className="mt-4 space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="pts-program" className="text-sm font-medium">
          Program
        </label>
        <Input
          id="pts-program"
          name="program"
          list="programs"
          placeholder="American Express Membership Rewards"
          value={program}
          onChange={(e) => handleProgramChange(e.target.value)}
          required
        />
        <datalist id="programs">
          {PROGRAMS.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="pts-balance" className="text-sm font-medium">
            Balance
          </label>
          <Input
            id="pts-balance"
            name="balance"
            inputMode="numeric"
            placeholder="270520"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="pts-cpp" className="text-sm font-medium">
            ¢ per point (auto)
          </label>
          <Input
            id="pts-cpp"
            name="cpp"
            inputMode="decimal"
            placeholder={autoCpp !== null ? String(autoCpp) : "1.5"}
            value={cpp}
            onChange={(e) => handleCppChange(e.target.value)}
          />
        </div>
      </div>
      {(isKnownProgram || previewValueCents !== null) && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {isKnownProgram && autoCpp !== null ? (
              <>
                {VALUATION_SOURCE.name} est.:{" "}
                <strong className="font-medium text-foreground">{formatCpp(autoCpp)}/pt</strong>
              </>
            ) : null}
            {isKnownProgram && previewValueCents !== null ? " · " : null}
            {previewValueCents !== null ? (
              <>
                Est. value:{" "}
                <strong className="font-medium tabular-nums text-foreground">
                  {formatCents(previewValueCents)}
                </strong>
              </>
            ) : null}
          </span>
          {isCustomInput && autoCpp !== null && (
            <button
              type="button"
              onClick={() => {
                setCpp(String(autoCpp));
                setCppEdited(false);
              }}
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Reset to auto ({formatCpp(autoCpp)})
            </button>
          )}
        </div>
      )}
    </ActionForm>
  );
}
