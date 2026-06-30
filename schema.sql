CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(100) NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'ta', 'instructor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS courses (
  course_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID REFERENCES users(user_id),
  title VARCHAR(200) NOT NULL,
  enrollment_code VARCHAR(20) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assignments (
  assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(course_id),
  title VARCHAR(200) NOT NULL,
  deadline TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  max_file_size_mb INTEGER NOT NULL DEFAULT 10,
  allow_resubmission BOOLEAN NOT NULL DEFAULT FALSE,
  is_open BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS rubrics (
  rubric_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES assignments(assignment_id) UNIQUE,
  title VARCHAR(120) NOT NULL,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  locked_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS rubric_criteria (
  criterion_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric_id UUID REFERENCES rubrics(rubric_id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  description VARCHAR(500) NOT NULL,
  max_points INTEGER NOT NULL CHECK (max_points > 0),
  display_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS submissions (
  submission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES assignments(assignment_id),
  student_id UUID,
  ta_id UUID,
  status TEXT NOT NULL DEFAULT 'pending_ai_review'
    CHECK (status IN ('pending_ai_review','pending_ta_review','pending_instructor_approval','released')),
  storage_key VARCHAR(500) NOT NULL,
  comment TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audit_log (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  event_type VARCHAR(80) NOT NULL,
  submission_id UUID REFERENCES submissions(submission_id),
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);