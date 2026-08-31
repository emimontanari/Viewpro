export type FeedbackType = 'ERROR' | 'SUGGESTION';

export type SubmitFeedbackInput = {
  type: FeedbackType;
  description: string;
};

export type SubmitFeedbackResponse = {
  accepted: true;
};
