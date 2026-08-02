const PAGE_SIZE = 10;

export function paginateSurveyAnswers(answers: string[], requestedPage: number) {
  const totalPages = Math.max(1, Math.ceil(answers.length / PAGE_SIZE));
  const page = Number.isInteger(requestedPage) && requestedPage > 0
    ? Math.min(requestedPage, totalPages)
    : 1;
  const startIndex = (page - 1) * PAGE_SIZE;

  return {
    items: answers.slice(startIndex, startIndex + PAGE_SIZE),
    page,
    startIndex,
    totalPages,
  };
}
