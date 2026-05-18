import { isPlainOldObject } from "./is-plain-old-object.ts";

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

export type ListRepositoryCommitsArgs = {
  /** The name of a repository branch, tag or revision range, or if not given the default branch. */
  ref_name?: string;
  /** Only commits after or on this date are returned in ISO 8601 format YYYY-MM-DDTHH:MM:SSZ. */
  since?: string;
  /** Only commits before or on this date are returned in ISO 8601 format YYYY-MM-DDTHH:MM:SSZ. */
  until?: string;
  /** The file path. */
  path?: string;
  /** Retrieve every commit from the repository. */
  all?: boolean;
  /** If true, retrieve stats about each commit. */
  with_stats?: boolean;
  /** If true, parses and includes Git trailers for every commit. */
  trailers?: boolean;
  /** List commits in order. Possible values: default, topo. Defaults to default, the commits are shown in reverse chronological order. */
  order?: "default" | "topo";
  /** Number of results to show per page. If not specified, defaults to 20. */
  per_page?: number;
  /** Page number. */
  page?: number;
};

export type ListRepositoryCommitsResponse = Array<GitlabCommit>;

export function isListRepositoryCommitsResponse(
  x: unknown,
): x is ListRepositoryCommitsResponse {
  return Array.isArray(x) && x.every(isGitlabCommit);
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

export type ListRepositoryTreesArgs = {
  /** Tree record ID at which to fetch the next page. Used only with keyset pagination. */
  page_token?: string;
  /** If keyset, use the keyset-based pagination method. */
  pagination?: string;
  /** Path inside the repository. Used to get content of subdirectories. */
  path?: string;
  /** Number of results to show per page. If not specified, defaults to 20. For more information, see pagination. */
  per_page?: number;
  /** If true, get a recursive tree. Default is false. */
  recursive?: boolean;
  /** Name of a repository branch or tag. If not specified, uses the default branch. */
  ref?: string;
};

export type ListRepositoryTreesResponse =
  Array<ListRepositoryTreesResponseItem>;

export function isListRepositoryTreesResponse(
  x: unknown,
): x is ListRepositoryTreesResponse {
  return Array.isArray(x) && x.every(isListRepositoryTreesResponseItem);
}

export type ListRepositoryTreesResponseItem = {
  id: string;
  name: string;
  type: "tree" | "blob" | string;
  path: string;
  mode: string;
};

export function isListRepositoryTreesResponseItem(
  x: unknown,
): x is ListRepositoryTreesResponseItem {
  return (
    isPlainOldObject(x) &&
    typeof x.id === "string" &&
    typeof x.name === "string" &&
    typeof x.type === "string" &&
    typeof x.path === "string" &&
    typeof x.mode === "string"
  );
}
