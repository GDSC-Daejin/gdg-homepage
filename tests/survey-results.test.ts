import { describe, expect, it } from "vitest";
import { paginateSurveyAnswers } from "@/lib/survey-results";

describe("paginateSurveyAnswers", () => {
  it("returns ten answers for the requested page", () => {
    const answers = Array.from({ length: 23 }, (_, index) => `응답 ${index + 1}`);

    expect(paginateSurveyAnswers(answers, 2)).toMatchObject({
      page: 2,
      totalPages: 3,
      items: answers.slice(10, 20),
    });
  });

  it("uses the first page for an invalid page number", () => {
    expect(paginateSurveyAnswers(["응답"], Number.NaN)).toMatchObject({
      page: 1,
      totalPages: 1,
      items: ["응답"],
    });
  });
});
