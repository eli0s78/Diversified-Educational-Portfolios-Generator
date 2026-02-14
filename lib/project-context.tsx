"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { ProjectData, ProjectIndexEntry } from "@/lib/project-manager";
import {
  getCurrentProject,
  listProjects,
  createNewProject,
  deleteProject,
  saveProject,
  setCurrentProjectId,
  loadProject,
  importProjectFromFile,
  exportProjectToFile,
  migrateLegacyData,
} from "@/lib/project-manager";

interface ProjectContextValue {
  currentProject: ProjectData | null;
  projects: ProjectIndexEntry[];
  switchProject: (id: string) => void;
  createProject: () => ProjectData;
  removeProject: (id: string) => void;
  importProject: (file: File) => Promise<ProjectData>;
  exportCurrentProject: () => void;
  refreshProjects: () => void;
  refreshCurrentProject: () => void;
  updateProject: (project: ProjectData) => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [currentProject, setCurrentProject] = useState<ProjectData | null>(null);
  const [projects, setProjects] = useState<ProjectIndexEntry[]>([]);

  // Initialize on mount
  useEffect(() => {
    migrateLegacyData();
    setProjects(listProjects());
    setCurrentProject(getCurrentProject());
  }, []);

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

  const handleImportProject = useCallback(async (file: File) => {
    const project = await importProjectFromFile(file);
    setCurrentProject(project);
    setProjects(listProjects());
    return project;
  }, []);

  const exportCurrentProjectFn = useCallback(() => {
    if (currentProject) {
      exportProjectToFile(currentProject);
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
        importProject: handleImportProject,
        exportCurrentProject: exportCurrentProjectFn,
        refreshProjects,
        refreshCurrentProject,
        updateProject,
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
