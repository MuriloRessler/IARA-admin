export const getCurrentAdmin = (request, response) => {
  response.status(200).json({
    id: request.admin.id,
    email: request.admin.email,
    role: 'admin',
  });
};
