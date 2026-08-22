import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "./firebase";
import type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
} from "../types/project";

enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path,
  };
  console.error("Firestore Projects Error:", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Generate a clean, URL-safe slug from project title
 */
export function generateProjectSlug(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `project-${Date.now().toString(36)}`;
}

/**
 * Normalize external URL to include https:// protocol if missing
 */
export function normalizeProjectUrl(url: string | undefined): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Fetch all projects for a given portfolio, sorted by order ascending
 */
export async function getPortfolioProjects(portfolioId: string): Promise<Project[]> {
  const path = `portfolios/${portfolioId}/projects`;
  try {
    const projectsCol = collection(db, "portfolios", portfolioId, "projects");
    // Attempt orderBy "order"
    let snap;
    try {
      const q = query(projectsCol, orderBy("order", "asc"));
      snap = await getDocs(q);
    } catch {
      // Fallback if index or legacy items lack order
      snap = await getDocs(projectsCol);
    }

    const projects: Project[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      projects.push({
        id: docSnap.id,
        portfolioId,
        ownerId: data.ownerId || "",
        title: data.title || "Untitled Project",
        slug: data.slug || docSnap.id,
        shortDescription: data.shortDescription || "",
        description: data.description || "",
        coverImage: data.coverImage || null,
        images: Array.isArray(data.images) ? data.images : [],
        role: data.role || "",
        client: data.client || "",
        year: data.year || "",
        services: Array.isArray(data.services) ? data.services : [],
        tools: Array.isArray(data.tools) ? data.tools : [],
        projectUrl: data.projectUrl || "",
        caseStudyUrl: data.caseStudyUrl || "",
        featured: Boolean(data.featured),
        order: typeof data.order === "number" ? data.order : projects.length,
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null,
      });
    });

    // Ensure sorted by order
    return projects.sort((a, b) => a.order - b.order);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Fetch a single project by ID
 */
export async function getPortfolioProject(
  portfolioId: string,
  projectId: string
): Promise<Project | null> {
  const path = `portfolios/${portfolioId}/projects/${projectId}`;
  try {
    const docRef = doc(db, "portfolios", portfolioId, "projects", projectId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return null;
    }
    const data = snap.data();
    return {
      id: snap.id,
      portfolioId,
      ownerId: data.ownerId || "",
      title: data.title || "Untitled Project",
      slug: data.slug || snap.id,
      shortDescription: data.shortDescription || "",
      description: data.description || "",
      coverImage: data.coverImage || null,
      images: Array.isArray(data.images) ? data.images : [],
      role: data.role || "",
      client: data.client || "",
      year: data.year || "",
      services: Array.isArray(data.services) ? data.services : [],
      tools: Array.isArray(data.tools) ? data.tools : [],
      projectUrl: data.projectUrl || "",
      caseStudyUrl: data.caseStudyUrl || "",
      featured: Boolean(data.featured),
      order: typeof data.order === "number" ? data.order : 0,
      createdAt: data.createdAt || null,
      updatedAt: data.updatedAt || null,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Unset featured status on all other projects in this portfolio
 */
async function clearOtherFeaturedProjects(
  portfolioId: string,
  excludeProjectId?: string
): Promise<void> {
  const projectsCol = collection(db, "portfolios", portfolioId, "projects");
  const snap = await getDocs(projectsCol);
  const batch = writeBatch(db);
  let batchCount = 0;

  snap.forEach((docSnap) => {
    if (docSnap.id !== excludeProjectId && docSnap.data().featured === true) {
      batch.update(docSnap.ref, { featured: false, updatedAt: serverTimestamp() });
      batchCount++;
    }
  });

  if (batchCount > 0) {
    await batch.commit();
  }
}

/**
 * Create a new project under a portfolio
 */
export async function createProject(
  portfolioId: string,
  input: CreateProjectInput
): Promise<Project> {
  const projectRef = doc(collection(db, "portfolios", portfolioId, "projects"));
  const projectId = projectRef.id;
  const path = `portfolios/${portfolioId}/projects/${projectId}`;

  // Get current project count to place at the end
  const existingProjects = await getPortfolioProjects(portfolioId);
  const nextOrder =
    existingProjects.length > 0
      ? Math.max(...existingProjects.map((p) => p.order)) + 1
      : 0;

  const isFeatured = Boolean(input.featured);
  if (isFeatured) {
    await clearOtherFeaturedProjects(portfolioId, projectId);
  }

  const slug = input.slug?.trim() || generateProjectSlug(input.title);

  const payload = {
    id: projectId,
    portfolioId,
    ownerId: auth.currentUser?.uid || "",
    title: input.title.trim(),
    slug,
    shortDescription: input.shortDescription.trim(),
    description: input.description ? input.description.trim() : "",
    coverImage: input.coverImage || null,
    images: Array.isArray(input.images) ? input.images.filter(Boolean) : [],
    role: input.role ? input.role.trim() : "",
    client: input.client ? input.client.trim() : "",
    year: input.year ? input.year.trim() : "",
    services: Array.isArray(input.services)
      ? input.services.map((s) => s.trim()).filter(Boolean)
      : [],
    tools: Array.isArray(input.tools)
      ? input.tools.map((t) => t.trim()).filter(Boolean)
      : [],
    projectUrl: normalizeProjectUrl(input.projectUrl),
    caseStudyUrl: normalizeProjectUrl(input.caseStudyUrl),
    featured: isFeatured,
    order: nextOrder,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(projectRef, payload);
    return {
      ...payload,
      id: projectId,
      createdAt: null,
      updatedAt: null,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Update an existing project
 */
export async function updateProject(
  portfolioId: string,
  projectId: string,
  input: UpdateProjectInput
): Promise<void> {
  const docRef = doc(db, "portfolios", portfolioId, "projects", projectId);
  const path = `portfolios/${portfolioId}/projects/${projectId}`;

  const isFeatured = Boolean(input.featured);
  if (isFeatured) {
    await clearOtherFeaturedProjects(portfolioId, projectId);
  }

  const updates: Record<string, unknown> = {
    title: input.title.trim(),
    shortDescription: input.shortDescription.trim(),
    description: input.description !== undefined ? input.description.trim() : "",
    coverImage: input.coverImage !== undefined ? input.coverImage : null,
    images: Array.isArray(input.images) ? input.images.filter(Boolean) : [],
    role: input.role !== undefined ? input.role.trim() : "",
    client: input.client !== undefined ? input.client.trim() : "",
    year: input.year !== undefined ? input.year.trim() : "",
    services: Array.isArray(input.services)
      ? input.services.map((s) => s.trim()).filter(Boolean)
      : [],
    tools: Array.isArray(input.tools)
      ? input.tools.map((t) => t.trim()).filter(Boolean)
      : [],
    projectUrl: normalizeProjectUrl(input.projectUrl),
    caseStudyUrl: normalizeProjectUrl(input.caseStudyUrl),
    featured: isFeatured,
    updatedAt: serverTimestamp(),
  };

  if (input.slug && input.slug.trim()) {
    updates.slug = generateProjectSlug(input.slug);
  }

  if (typeof input.order === "number") {
    updates.order = input.order;
  }

  try {
    await updateDoc(docRef, updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Delete a project from a portfolio
 */
export async function deleteProject(
  portfolioId: string,
  projectId: string
): Promise<void> {
  const docRef = doc(db, "portfolios", portfolioId, "projects", projectId);
  const path = `portfolios/${portfolioId}/projects/${projectId}`;
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Persist new project ordering
 */
export async function reorderProjects(
  portfolioId: string,
  orderedProjectIds: string[]
): Promise<void> {
  const path = `portfolios/${portfolioId}/projects`;
  try {
    const batch = writeBatch(db);
    orderedProjectIds.forEach((id, index) => {
      const docRef = doc(db, "portfolios", portfolioId, "projects", id);
      batch.update(docRef, {
        order: index,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Set a single project as featured or unset all
 */
export async function setFeaturedProject(
  portfolioId: string,
  featuredProjectId: string | null
): Promise<void> {
  const path = `portfolios/${portfolioId}/projects`;
  try {
    const projects = await getPortfolioProjects(portfolioId);
    const batch = writeBatch(db);

    projects.forEach((proj) => {
      const isTarget = proj.id === featuredProjectId;
      if (proj.featured !== isTarget) {
        const docRef = doc(db, "portfolios", portfolioId, "projects", proj.id);
        batch.update(docRef, {
          featured: isTarget,
          updatedAt: serverTimestamp(),
        });
      }
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}
