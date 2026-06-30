import express from "express";
import multer from "multer";
import { verifyTOken, requireRole, supabase } from "../middleware/auth.js";

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if(file.mimetype !== 'application/pdf' ){
            return cb(new Error('FILE_INVALID'));
        }
        cb(null, true);
    }
});

//POST /api/v1/assignments/:assignmentID/submissions
router.post(
    "/assignments/:assignmentID/submissions",
    verifyTOken,
    requireRole('student'),
    (req, res, next) => {
        upload.single('file')(req, res, (err) => {
            if(err && err.message === 'FILE_INVALID'){
                return res.status(400).json({
                    error: { code: 'FILE_INVALID', message: 'Only PDF files are allowed in the submission!'}
                });
            }
            if (err) return next(err);
            next();
        });
    },
    async (req, res) => {
        const {assignmentID} = req.params;
        const studentID = req.user.id;

        if(!req.file){
            return res.status(400).json({
                error: { code: 'FILE_INVALID', message: 'A PDF file is required for submission!' }
            });
        }

        const comment = req.body.comment || null;
        if(comment && comment.length > 500){
            return res.status(400).json({
                error: {code: 'VALIDATION_FAILED_SUCCESSFULLY', message: 'Comments must be at most 500 characters!'}
            });
        }

        const {data: assignment, error: assignErr} = await supabase
            .from('assignments')
            .select('*')
            .eq('assignment_id', assignmentID)
            .single();
        
        if (assignErr || !assignment){
            return res.status(404).json({
                error: {code: 'NOT_FOUND', message: 'Assignment not found!'}
            });
        }

        if(!assignment.is_open || new Date() > new Date(assignment.deadline)){
            return res.status(409).json({
                error: {code: 'DEADLINE_PASSED', message: 'This assignment is closed for submission!'}
            });
        }

        const maxBytes = assignment.max_file_size_mb * 1024 * 1024;
        if(req.file.size > maxBytes){
            return res.status(400).json({
                error: {
                    code: 'SIZE_EXCEEDED',
                    message: `File exceeds the ${assignment.max_file_size_mb}MB limit for this assignment.`
                }
            });
        }

        const storageKey = `${assignmentID}/${studentID}/${Date.now()}.pdf`;
        const {error: uploadErr} = await supabase.storage
            .from('submissions')
            .upload(storageKey, req.file.buffer, {
                contentType: 'application/pdf',
                upsert: false
            });
        
        if(uploadErr){
            console.error('Storage upload error:', uploadErr);
            return res.status(500).json({
                error: {code: 'STORAGE_ERROR', message: 'File Stprage failed'}
            });
        }

        const {data: submission, error: dbErr} = await supabase
            .from('submissions')
            .insert({
                assignment_id: assignmentID,
                student_id: studentID,
                status: 'pending_ai_review',
                storage_key: storageKey,
                comment,
                version: 1
            })
            .select()
            .single();
        
        if(dbErr){
            console.error('DB insert error:', dbErr);
            return res.status(500).json({
                error: {code: 'DB_ERROR', message: 'Failed to save the submission'}
            });
        }

        await supabase.from('audit_log').insert({
            actor_id: studentID,
            event_type: 'SUBMISSION_CREATED',
            submission_id: submission.submission_id,
            payload: {assignmentID, fileSize: req.file.size}
        });

        return res.status(201).json({
            data:{
                submissionId: submission.submission_id,
                assignmentId: submission.assignment_id,
                studentId: submission.student_id,
                status: submission.status,
                submittedAt: submission.submitted_at,
                version: submission.version
            }
        });
    }
);

router.get(
    '/submissions/:submissionID',
    verifyTOken,
    requireRole('student', 'ta', 'instructor'),
    async(req, res) => {
        const {submissionID} = req.params;
        const callerID = req.user.id;
        const callerRole = req.user.user_metadata?.role;

        const {data: submission, error} = await supabase
            .from('submissions')
            .select('*')
            .eq('submission_id', submissionID)
            .single();
        
        if(error || !submission){
            return res.status(404).json({
                error: {code: 'NOT_FOUND', message: 'Submission not found'}
            });
        }

        if(callerRole === 'student' && submission.student_id !== callerID){
            return res.status(403).json({
                error: {code: 'FORBIDDEN', message: 'You can only access your own submissions!'}
            });
        }

        if(callerRole === 'ta' && submission.ta_id !== callerID){
            return res.status(403).json({
                error: {code: 'FORBIDDEN', message: 'This submission is not in your queue!'}
            });
        }

        return res.status(200).json({
            data: {
                submission_id: submission.submission_id,
                assignment_id: submission.assignment_id,
                student_id: submission.student_id,
                status: submission.status,
                comment: submission.comment,
                version: submission.version,
                submittedAt: submission.submitted_at,
                releasedAt: submission.released_at || null
            }
        });
    }
);

export default router;