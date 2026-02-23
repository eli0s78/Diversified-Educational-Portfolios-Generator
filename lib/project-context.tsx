"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type { ProjectData, ProjectIndexEntry } from "@/lib/project-manager";
import {
  getCurrentProject,
  listProjects,
  createNewProject,
  deleteProject,
  renameProject as renameProjectInStorage,
  saveProject,
  setCurrentProjectId,
  loadProject,
  importProjectFromFile,
  exportProjectToFile,
  migrateLegacyData,
} from "@/lib/project-manager";

export interface UploadFiles {
  pdfFiles: File[];
  topicsFile: File | null;
  papersFile: File | null;
}

const EMPTY_UPLOAD_FILES: UploadFiles = { pdfFiles: [], topicsFile: null, papersFile: null };

interface ProjectContextValue {
  currentProject: ProjectData | null;
  projects: ProjectIndexEntry[];
  switchProject: (id: string) => void;
  createProject: () => ProjectData;
  removeProject: (id: string) => void;
  renameProject: (id: string, newName: string) => void;
  importProject: (file: File) => Promise<ProjectData>;
  exportCurrentProject: () => void;
  refreshProjects: () => void;
  refreshCurrentProject: () => void;
  updateProject: (project: ProjectData) => void;
  uploadFiles: UploadFiles;
  setUploadFiles: React.Dispatch<React.SetStateAction<UploadFiles>>;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [currentProject, setCurrentProject] = useState<ProjectData | null>(null);
  const [projects, setProjects] = useState<ProjectIndexEntry[]>([]);
  const [uploadFiles, setUploadFiles] = useState<UploadFiles>(EMPTY_UPLOAD_FILES);
  const prevProjectIdRef = useRef<string | null>(null);

  // Initialize on mount
  useEffect(() => {
    migrateLegacyData();
    setProjects(listProjects());
    const project = getCurrentProject();
    setCurrentProject(project);
    prevProjectIdRef.current = project?.id ?? null;
  }, []);

  // Clear upload files when project changes
  useEffect(() => {
    const newId = currentProject?.id ?? null;
    if (prevProjectIdRef.current !== null && newId !== prevProjectIdRef.current) {
      setUploadFiles(EMPTY_UPLOAD_FILES);
    }
    prevProjectIdRef.current = newId;
  }, [currentProject?.id]);

  const refreshProjects = useCallback(() => {
    setProjects(listProjects());
  }, []);

  const refreshCurrentProject = useCallback(() => {
    setCurrentProject(getCurrentProject());
  }, []);

  const switchProject = useCallback((id: string) => {
    setCurrentProjectId(id);
    const project = loadProject(id);
    setCurrentProject(project);
  }, []);

  const handleCreateProject = useCallback(() => {
    const project = createNewProject();
    setCurrentProject(project);
    setProjects(listProjects());
    return project;
  }, []);

  const removeProject = useCallback(
    (id: string) => {
      deleteProject(id);
      setProjects(listProjects());
      if (currentProject?.id === id) {
        setCurrentProject(null);
      }
    },
    [currentProject?.id]
  );

  const handleRenameProject = useCallback(
    (id: string, newName: string) => {
      renameProjectInStorage(id, newName);
      setProjects(listProjects());
      if (currentProject?.id === id) {
        setCurrentProject((prev) => prev ? { ...prev, name: newName } : prev);
      }
    },
    [currentProject?.id]
  );

  const handleImportProject = useCallback(async (file: File) => {
    const project = await importProjectFromFile(file);
    setCurrentProject(project);
    setProjects(listProjects());
    return project;
  }, []);

  const exportCurrentProjectFn = useCallback(async () => {
    if (currentProject) {
      try {
        await exportProjectToFile(currentProject);
      } catch (err) {
        console.error("Export error:", err);
      }
    }
  }, [currentProject]);

  const updateProject = useCallback((project: ProjectData) => {
    saveProject(project);
    setCurrentProject({ ...project });
    setProjects(listProjects());
  }, []);

  return (
    <ProjectContext.Provider
      value={{
        currentProject,
        projects,
        switchProject,
        createProject: handleCreateProject,
        removeProject,
        renameProject: handleRenameProject,
        importProject: handleImportProject,
        exportCurrentProject: exportCurrentProjectFn,
        refreshProjects,
        refreshCurrentProject,
        updateProject,
        uploadFiles,
        setUploadFiles,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return ctx;
}
