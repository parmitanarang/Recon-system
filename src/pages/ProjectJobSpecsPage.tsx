import { Link, useNavigate, useParams } from "react-router-dom";
import { useData } from "../context/DataContext";

export function ProjectJobSpecsPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const { projects, jobSpecs, deleteJobSpec } = useData();

  const project = projects.find((p) => p.id === projectId);
  const specsForProject = jobSpecs.filter((spec) => spec.projectId === projectId);

  const handleDeleteSpec = async (id: string, name: string) => {
    const confirmed = window.confirm(
      `Delete job spec "${name}"? This will also remove its job runs from this session.`
    );
    if (!confirmed) return;
    await Promise.resolve(deleteJobSpec(id));
  };

  if (!project) {
    return (
      <section>
        <button className="link-button" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <p className="page-subtitle">Project not found.</p>
      </section>
    );
  }

  return (
    <section>
      <button className="link-button" onClick={() => navigate(-1)}>
        ← Projects
      </button>

      <div className="page-header">
        <div>
          <h1 className="page-title">{project.name}</h1>
          <p className="page-subtitle">All job specs in this project.</p>
        </div>
        <button
          className="btn-primary"
          type="button"
          onClick={() => navigate(`/projects/${project.id}/job-specs/new`)}
        >
          + New job spec
        </button>
      </div>

      <div className="grid-cards">
        {specsForProject.map((spec) => (
          <div key={spec.id} className="card card-clickable card-with-footer">
            <Link
              to={`/projects/${project.id}/job-specs/${spec.id}`}
              className="card-main-link"
            >
              <div className="card-icon-folder" aria-hidden="true" />
              <div className="card-content">
                <h2 className="card-title">{spec.name}</h2>
                <p className="card-description">{spec.description}</p>
              </div>
            </Link>
            <div className="card-footer">
              <button
                type="button"
                className="link-button-small"
                onClick={() =>
                  navigate(`/projects/${project.id}/job-specs/${spec.id}/edit`)
                }
              >
                Edit
              </button>
              <button
                type="button"
                className="link-button-small link-button-danger"
                onClick={() => handleDeleteSpec(spec.id, spec.name)}
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

