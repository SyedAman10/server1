const courseModel = require('../models/course.model');

/**
 * Course Service
 * Handles business logic for course operations
 */

// Create a new course
async function createCourse({ name, description, section, room, teacherId }) {
  try {
    // Check if course with same name already exists for this teacher
    const existingCourse = await courseModel.getCourseByNameAndTeacher(name, teacherId);
    if (existingCourse) {
      throw new Error(`Course with name "${name}" already exists for this teacher`);
    }

    const course = await courseModel.createCourse({
      name,
      description,
      section,
      room,
      teacherId
    });

    return {
      success: true,
      course,
      message: `Course "${name}" created successfully!`
    };
  } catch (error) {
    console.error('Error creating course:', error);
    throw error;
  }
}

// Get courses based on user role
async function getCourses(userId, userRole) {
  try {
    let courses;

    switch (userRole) {
      case 'teacher':
        courses = await courseModel.getCoursesByTeacher(userId);
        break;
      case 'student':
        courses = await courseModel.getCoursesByStudent(userId);
        break;
      case 'super_admin':
        courses = await courseModel.getAllCourses();
        break;
      default:
        throw new Error('Invalid user role');
    }

    return {
      success: true,
      courses,
      count: courses.length
    };
  } catch (error) {
    console.error('Error getting courses:', error);
    throw error;
  }
}

// Get a single course by ID
async function getCourseById(courseId, userId, userRole) {
  try {
    const course = await courseModel.getCourseById(courseId);

    if (!course) {
      throw new Error('Course not found');
    }

    // Check permissions
    if (userRole === 'teacher' && course.teacher_id !== userId) {
      throw new Error('You do not have permission to view this course');
    }

    if (userRole === 'student') {
      const isEnrolled = await courseModel.isStudentEnrolled(courseId, userId);
      if (!isEnrolled) {
        throw new Error('You are not enrolled in this course');
      }
    }

    return {
      success: true,
      course
    };
  } catch (error) {
    console.error('Error getting course:', error);
    throw error;
  }
}

// Update a course
async function updateCourse(courseId, updates, userId, userRole) {
  try {
    const course = await courseModel.getCourseById(courseId);

    if (!course) {
      throw new Error('Course not found');
    }

    // Only teachers who own the course and super_admins can update
    if (userRole === 'teacher' && course.teacher_id !== userId) {
      throw new Error('You do not have permission to update this course');
    }

    if (userRole === 'student') {
      throw new Error('Students cannot update courses');
    }

    const updatedCourse = await courseModel.updateCourse(courseId, updates);

    return {
      success: true,
      course: updatedCourse,
      message: 'Course updated successfully'
    };
  } catch (error) {
    console.error('Error updating course:', error);
    throw error;
  }
}

// Delete a course
async function deleteCourse(courseId, userId, userRole) {
  try {
    const course = await courseModel.getCourseById(courseId);

    if (!course) {
      throw new Error('Course not found');
    }

    // Only teachers who own the course and super_admins can delete
    if (userRole === 'teacher' && course.teacher_id !== userId) {
      throw new Error('You do not have permission to delete this course');
    }

    if (userRole === 'student') {
      throw new Error('Students cannot delete courses');
    }

    await courseModel.deleteCourse(courseId);

    return {
      success: true,
      message: `Course "${course.name}" deleted successfully`
    };
  } catch (error) {
    console.error('Error deleting course:', error);
    throw error;
  }
}

// Enroll a student in a course
async function enrollStudent(courseId, studentId, userId, userRole) {
  try {
    const course = await courseModel.getCourseById(courseId);

    if (!course) {
      throw new Error('Course not found');
    }

    // Only teachers who own the course and super_admins can enroll students
    if (userRole === 'teacher' && course.teacher_id !== userId) {
      throw new Error('You do not have permission to enroll students in this course');
    }

    if (userRole === 'student') {
      throw new Error('Students cannot enroll other students');
    }

    const enrollment = await courseModel.enrollStudent(courseId, studentId);

    if (!enrollment) {
      return {
        success: true,
        message: 'Student is already enrolled in this course'
      };
    }

    return {
      success: true,
      enrollment,
      message: 'Student enrolled successfully'
    };
  } catch (error) {
    console.error('Error enrolling student:', error);
    throw error;
  }
}

// Unenroll a student from a course
async function unenrollStudent(courseId, studentId, userId, userRole) {
  try {
    const course = await courseModel.getCourseById(courseId);

    if (!course) {
      throw new Error('Course not found');
    }

    // Only teachers who own the course and super_admins can unenroll students
    if (userRole === 'teacher' && course.teacher_id !== userId) {
      throw new Error('You do not have permission to unenroll students from this course');
    }

    if (userRole === 'student' && studentId !== userId) {
      throw new Error('Students can only unenroll themselves');
    }

    await courseModel.unenrollStudent(courseId, studentId);

    return {
      success: true,
      message: 'Student unenrolled successfully'
    };
  } catch (error) {
    console.error('Error unenrolling student:', error);
    throw error;
  }
}

// Get enrolled students in a course
async function getEnrolledStudents(courseId, userId, userRole) {
  try {
    const course = await courseModel.getCourseById(courseId);

    if (!course) {
      throw new Error('Course not found');
    }

    // Check permissions
    if (userRole === 'teacher' && course.teacher_id !== userId) {
      throw new Error('You do not have permission to view students in this course');
    }

    if (userRole === 'student') {
      const isEnrolled = await courseModel.isStudentEnrolled(courseId, userId);
      if (!isEnrolled) {
        throw new Error('You are not enrolled in this course');
      }
    }

    const students = await courseModel.getEnrolledStudents(courseId);

    return {
      success: true,
      students,
      count: students.length
    };
  } catch (error) {
    console.error('Error getting enrolled students:', error);
    throw error;
  }
}

module.exports = {
  createCourse,
  getCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
  enrollStudent,
  unenrollStudent,
  getEnrolledStudents
};

