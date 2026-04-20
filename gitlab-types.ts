import { isPlainOldObject } from "../common-type-guards";

export type CommitAction = {
  action: "create" | "delete" | "move" | "update" | "chmod"; //	yes	The action to perform, create, delete, move, update, chmod
  file_path: string; //	yes	Full path to the file. Ex. lib/class.rb
  previous_path?: string; //	no	Original full path to the file being moved. Ex. lib/class1.rb. Only considered for move action.
  content?: string; //	no	File content, required for all except delete, chmod, and move. Move actions that do not specify content preserve the existing file content, and any other value of content overwrites the file content.
  encoding?: "text" | "base64"; //	no	text or base64. text is default.
  last_commit_id?: string; //	no	Last known file commit ID. Only considered in update, move, and delete actions.
  execute_filemode?: boolean; //	no	When true/false enables/disables the execute flag on the file. Only considered for chmod action.
};

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

export type RepositoryFile = {
  file_name: string;
  file_path: string;
  size: number;
  encoding: "base64" | string;
  content_sha256: string;
  ref: string;
  blob_id: string;
  commit_id: string;
  last_commit_id: string;
  execute_filemode: boolean;
  content: string;
};

export function isRepositoryFile(x: unknown): x is RepositoryFile {
  return (
    isPlainOldObject(x) &&
    typeof x.file_name === "string" &&
    typeof x.file_path === "string" &&
    typeof x.size === "number" &&
    typeof x.encoding === "string" &&
    typeof x.content_sha256 === "string" &&
    typeof x.ref === "string" &&
    typeof x.blob_id === "string" &&
    typeof x.commit_id === "string" &&
    typeof x.last_commit_id === "string" &&
    typeof x.execute_filemode === "boolean" &&
    typeof x.content === "string"
  );
}
