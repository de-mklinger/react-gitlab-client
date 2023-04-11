import { isPlainOldObject } from "../common-type-guards";

export type GitlabCommit = Partial<GitlabExampleCommit> & {
  id: string;
  [key: string]: unknown;
};

export function isGitlabCommit(x: unknown): x is GitlabCommit {
  return isPlainOldObject(x) && typeof x.id === "string";
}

// Taken from example at https://docs.gitlab.com/ee/api/commits.html
type GitlabExampleCommit = {
  id: string;
  short_id: string;
  title: string;
  author_name: string;
  author_email: string;
  committer_name: string;
  committer_email: string;
  created_at: string;
  message: string;
  parent_ids: string[];
  committed_date: string;
  authored_date: string;
  stats: Record<string, unknown>;
  status: unknown;
  web_url: string;
};
