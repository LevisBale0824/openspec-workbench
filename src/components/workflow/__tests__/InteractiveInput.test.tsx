import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InteractiveInput } from "../InteractiveInput";

describe("InteractiveInput", () => {
  it("renders nothing when mode is hidden", () => {
    const { container } = render(
      <InteractiveInput
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        mode="hidden"
        disabled={false}
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders with ready mode", () => {
    render(
      <InteractiveInput
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        mode="ready"
        disabled={false}
      />
    );
    expect(screen.getByPlaceholderText("输入消息回复 AI...")).toBeTruthy();
    expect(screen.getByText("发送")).toBeTruthy();
  });

  it("renders with prompted mode (AI waiting)", () => {
    render(
      <InteractiveInput
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        mode="prompted"
        disabled={false}
      />
    );
    expect(screen.getByPlaceholderText("AI 在等你回答...")).toBeTruthy();
    // The outer container should have the pulsing animation
    const outerDiv = screen.getByPlaceholderText("AI 在等你回答...").parentElement;
    expect(outerDiv?.className).toContain("animate-pulse");
  });

  it("calls onSubmit when send button is clicked", () => {
    let submitted = false;
    render(
      <InteractiveInput
        value="test answer"
        onChange={() => {}}
        onSubmit={() => { submitted = true; }}
        mode="ready"
        disabled={false}
      />
    );
    fireEvent.click(screen.getByText("发送"));
    expect(submitted).toBe(true);
  });

  it("disables send button when input is empty", () => {
    render(
      <InteractiveInput
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        mode="ready"
        disabled={false}
      />
    );
    const button = screen.getByText("发送");
    expect(button.hasAttribute("disabled")).toBe(true);
  });

  it("disables input when disabled prop is true", () => {
    render(
      <InteractiveInput
        value="hello"
        onChange={() => {}}
        onSubmit={() => {}}
        mode="ready"
        disabled={true}
      />
    );
    const input = screen.getByPlaceholderText("输入消息回复 AI...");
    expect(input.hasAttribute("disabled")).toBe(true);
  });
});
