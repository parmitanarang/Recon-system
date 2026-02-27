import { Link } from "react-router-dom";
import { FormEvent, useState } from "react";
import { useData } from "../context/DataContext";

type ProjectFormState = {
  name: string;
  description: string;
};

const emptyForm: ProjectFormState = { name: "", description: "" };

export function ProjectsPage() {
  const { projects, addProject, updateProject, deleteProject } = useData();
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProjectFormState>(emptyForm);

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setIsCreating(true);
  };

  const startEdit = (id: string, current: ProjectFormState) => {
    setIsCreating(false);
    setEditingId(id);
    setForm(current);
  };

  const resetForm = () => {
    setIsCreating(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const { name, description } = form;
    if (!name.trim()) return;

    await Promise.resolve(
      editingId
        ? updateProject(editingId, { name, description })
        : addProject({ name, description })
    );
    resetForm();
  };

  const handleDelete = async (id: string, name: string) => {
    const confirmed = window.confirm(
      `Delete project "${name}"? This will also remove its job specs and job runs from this session.`
    );
    if (!confirmed) return;
    await Promise.resolve(deleteProject(id));
    if (editingId === id) resetForm();
  };

  return (
    <section>
      <div className="page-header">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">
            Organise reconciliation work into focused project spaces.
          </p>
        </div>
        <button className="btn-primary" onClick={startCreate}>
          + Create
        </button>
      </div>

      {(isCreating || editingId) && (
        <form className="card card-form" onSubmit={handleSubmit}>
          <div className="card-icon-folder" aria-hidden="true" />
          <div className="card-content card-form-content">
            <div className="field-row">
              <label className="field-label">
                Project name
                <input
                  className="text-input"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Load Money"
                  required
                />
              </label>
            </div>
            <div className="field-row">
              <label className="field-label">
                Description
                <input
                  className="text-input"
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="Optional short description"
                />
              </label>
            </div>
            <div className="card-actions">
              <button type="button" className="btn-secondary btn-xs" onClick={resetForm}>
                Cancel
              </button>
              <button type="submit" className="btn-primary btn-xs">
                {editingId ? "Save changes" : "Create project"}
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="grid-cards">
        {projects.map((project) => (
          <div key={project.id} className="card card-clickable card-with-footer">
            <Link
              to={`/projects/${project.id}`}
              className="card-main-link"
              aria-label={`Open project ${project.name}`}
            >
              <div className="card-icon-folder" aria-hidden="true" />
              <div className="card-content">
                <h2 className="card-title">{project.name}</h2>
                <p className="card-description">{project.description}</p>
              </div>
            </Link>
            <div className="card-footer">
              <button
                type="button"
                className="link-button-small"
                onClick={() =>
                  startEdit(project.id, {
                    name: project.name,
                    description: project.description
                  })
                }
              >
                Edit
              </button>
              <button
                type="button"
                className="link-button-small link-button-danger"
                onClick={() => handleDelete(project.id, project.name)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

