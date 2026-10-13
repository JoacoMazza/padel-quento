// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DateField } from "@/app/admin/date-field";

describe("DateField", () => {
  afterEach(() => {
    cleanup();
  });

  it("muestra la fecha como día/mes/año, sin depender del idioma del navegador", () => {
    render(<DateField id="fecha" label="Fecha" value="2026-10-20" onChange={() => {}} />);

    expect(screen.getByText("20/10/2026")).toBeTruthy();
    expect((screen.getByLabelText("Fecha") as HTMLInputElement).value).toBe("2026-10-20");
  });

  it("sin fecha muestra el formato esperado", () => {
    render(<DateField id="fin" label="Fecha de fin (opcional)" value="" onChange={() => {}} />);

    expect(screen.getByText("dd/mm/aaaa")).toBeTruthy();
  });

  it("avisa la fecha elegida en el calendario", () => {
    const onChange = vi.fn();
    render(<DateField id="fecha" label="Fecha" value="2026-10-20" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-11-02" } });

    expect(onChange).toHaveBeenCalledWith("2026-11-02");
  });
});
